"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
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
            stats: {
                warnings: false,
                errors: false
            },
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
                sri: buildOptions.subresourceIntegrity,
            }),
        ]),
        node: false,
    };
}
exports.getBrowserConfig = getBrowserConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncy9icm93c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7QUFDSCxpQkFBaUI7QUFDakIsK0RBQStEOztBQUUvRCw2QkFBNkI7QUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQztBQUN6RCxNQUFNLDBCQUEwQixHQUFHLE9BQU8sQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0FBQzVFLG1FQUE4RDtBQUM5RCwyRUFBMkY7QUFDM0YsbUVBQW9FO0FBQ3BFLHVGQUFpRjtBQUVqRixtQ0FBb0Q7QUFFcEQ7Ozs7O0lBS0k7QUFFSixTQUFnQixnQkFBZ0IsQ0FBQyxHQUF5QjtJQUN4RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFHaEQsSUFBSSxZQUFZLEdBQVUsRUFBRSxDQUFDO0lBRTdCLHFEQUFxRDtJQUNyRCxNQUFNLG9CQUFvQixHQUFHLGlDQUF5QjtJQUNwRCxvRkFBb0Y7SUFDcEYsQ0FBQyxHQUFHLFlBQVksQ0FBQyxNQUFNLEVBQUUsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLEVBQUUsVUFBVSxDQUFDO1NBQzdELE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7U0FDM0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFBO0lBRWpDLE1BQU0saUJBQWlCLEdBQUcsS0FBSyxDQUFDO0lBQ2hDLElBQUksaUJBQWlCLEVBQUU7UUFDckIsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLGlCQUFpQixDQUFDO1lBQ3RDLFFBQVEsRUFB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c2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbi8vIHRzbGludDpkaXNhYmxlXG4vLyBUT0RPOiBjbGVhbnVwIHRoaXMgZmlsZSwgaXQncyBjb3BpZWQgYXMgaXMgZnJvbSBBbmd1bGFyIENMSS5cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmNvbnN0IEh0bWxXZWJwYWNrUGx1Z2luID0gcmVxdWlyZSgnaHRtbC13ZWJwYWNrLXBsdWdpbicpO1xuY29uc3QgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4gPSByZXF1aXJlKCd3ZWJwYWNrLXN1YnJlc291cmNlLWludGVncml0eScpO1xuaW1wb3J0IHsgTGljZW5zZVdlYnBhY2tQbHVnaW4gfSBmcm9tICdsaWNlbnNlLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMsIHBhY2thZ2VDaHVua1NvcnQgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IEJhc2VIcmVmV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL2xpYi9iYXNlLWhyZWYtd2VicGFjayc7XG5pbXBvcnQgeyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzIH0gZnJvbSAnLi91dGlscyc7XG5cbi8qKlxuKyAqIGxpY2Vuc2Utd2VicGFjay1wbHVnaW4gaGFzIGEgcGVlciBkZXBlbmRlbmN5IG9uIHdlYnBhY2stc291cmNlcywgbGlzdCBpdCBpbiBhIGNvbW1lbnQgdG9cbisgKiBsZXQgdGhlIGRlcGVuZGVuY3kgdmFsaWRhdG9yIGtub3cgaXQgaXMgdXNlZC5cbisgKlxuKyAqIHJlcXVpcmUoJ3dlYnBhY2stc291cmNlcycpXG4rICovXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRCcm93c2VyQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpIHtcbiAgY29uc3QgeyByb290LCBwcm9qZWN0Um9vdCwgYnVpbGRPcHRpb25zIH0gPSB3Y287XG5cblxuICBsZXQgZXh0cmFQbHVnaW5zOiBhbnlbXSA9IFtdO1xuXG4gIC8vIEZpZ3VyZSBvdXQgd2hpY2ggYXJlIHRoZSBsYXp5IGxvYWRlZCBidW5kbGUgbmFtZXMuXG4gIGNvbnN0IGxhenlDaHVua0J1bmRsZU5hbWVzID0gbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhcbiAgICAvLyBXZSBkb24ndCByZWFsbHkgbmVlZCBhIGRlZmF1bHQgbmFtZSBiZWNhdXNlIHdlIHByZS1maWx0ZXJlZCBieSBsYXp5IG9ubHkgZW50cmllcy5cbiAgICBbLi4uYnVpbGRPcHRpb25zLnN0eWxlcywgLi4uYnVpbGRPcHRpb25zLnNjcmlwdHNdLCAnbm90LWxhenknKVxuICAgIC5maWx0ZXIoZW50cnkgPT4gZW50cnkubGF6eSlcbiAgICAubWFwKGVudHJ5ID0+IGVudHJ5LmJ1bmRsZU5hbWUpXG5cbiAgY29uc3QgZ2VuZXJhdGVJbmRleEh0bWwgPSBmYWxzZTtcbiAgaWYgKGdlbmVyYXRlSW5kZXhIdG1sKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IEh0bWxXZWJwYWNrUGx1Z2luKHtcbiAgICAgIHRlbXBsYXRlOiBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLmluZGV4KSxcbiAgICAgIGZpbGVuYW1lOiBwYXRoLnJlc29sdmUoYnVpbGRPcHRpb25zLm91dHB1dFBhdGgsIGJ1aWxkT3B0aW9ucy5pbmRleCksXG4gICAgICBjaHVua3NTb3J0TW9kZTogcGFja2FnZUNodW5rU29ydChidWlsZE9wdGlvbnMpLFxuICAgICAgZXhjbHVkZUNodW5rczogbGF6eUNodW5rQnVuZGxlTmFtZXMsXG4gICAgICB4aHRtbDogdHJ1ZSxcbiAgICAgIG1pbmlmeTogYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbiA/IHtcbiAgICAgICAgY2FzZVNlbnNpdGl2ZTogdHJ1ZSxcbiAgICAgICAgY29sbGFwc2VXaGl0ZXNwYWNlOiB0cnVlLFxuICAgICAgICBrZWVwQ2xvc2luZ1NsYXNoOiB0cnVlXG4gICAgICB9IDogZmFsc2VcbiAgICB9KSk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IEJhc2VIcmVmV2VicGFja1BsdWdpbih7XG4gICAgICBiYXNlSHJlZjogYnVpbGRPcHRpb25zLmJhc2VIcmVmIGFzIHN0cmluZ1xuICAgIH0pKTtcbiAgfVxuXG4gIGxldCBzb3VyY2VtYXBzOiBzdHJpbmcgfCBmYWxzZSA9IGZhbHNlO1xuICBpZiAoYnVpbGRPcHRpb25zLnNvdXJjZU1hcCkge1xuICAgIC8vIFNlZSBodHRwczovL3dlYnBhY2suanMub3JnL2NvbmZpZ3VyYXRpb24vZGV2dG9vbC8gZm9yIHNvdXJjZW1hcCB0eXBlcy5cbiAgICBpZiAoYnVpbGRPcHRpb25zLmV2YWxTb3VyY2VNYXAgJiYgIWJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24pIHtcbiAgICAgIC8vIFByb2R1Y2UgZXZhbCBzb3VyY2VtYXBzIGZvciBkZXZlbG9wbWVudCB3aXRoIHNlcnZlLCB3aGljaCBhcmUgZmFzdGVyLlxuICAgICAgc291cmNlbWFwcyA9ICdldmFsJztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUHJvZHVjZSBmdWxsIHNlcGFyYXRlIHNvdXJjZW1hcHMgZm9yIHByb2R1Y3Rpb24uXG4gICAgICBzb3VyY2VtYXBzID0gJ3NvdXJjZS1tYXAnO1xuICAgIH1cbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHkpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4oe1xuICAgICAgaGFzaEZ1bmNOYW1lczogWydzaGEzODQnXVxuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IExpY2Vuc2VXZWJwYWNrUGx1Z2luKHtcbiAgICAgIHN0YXRzOiB7XG4gICAgICAgIHdhcm5pbmdzOiBmYWxzZSxcbiAgICAgICAgZXJyb3JzOiBmYWxzZVxuICAgICAgfSxcbiAgICAgIHBlckNodW5rT3V0cHV0OiBmYWxzZSxcbiAgICAgIG91dHB1dEZpbGVuYW1lOiBgM3JkcGFydHlsaWNlbnNlcy50eHRgXG4gICAgfSkpO1xuICB9XG5cbiAgY29uc3QgZ2xvYmFsU3R5bGVzQnVuZGxlTmFtZXMgPSBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKGJ1aWxkT3B0aW9ucy5zdHlsZXMsICdzdHlsZXMnKVxuICAgIC5tYXAoc3R5bGUgPT4gc3R5bGUuYnVuZGxlTmFtZSk7XG5cbiAgcmV0dXJuIHtcbiAgICBkZXZ0b29sOiBzb3VyY2VtYXBzLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIG1haW5GaWVsZHM6IFtcbiAgICAgICAgLi4uKHdjby5zdXBwb3J0RVMyMDE1ID8gWydlczIwMTUnXSA6IFtdKSxcbiAgICAgICAgJ2Jyb3dzZXInLCAnbW9kdWxlJywgJ21haW4nXG4gICAgICBdXG4gICAgfSxcbiAgICBvdXRwdXQ6IHtcbiAgICAgIGNyb3NzT3JpZ2luTG9hZGluZzogYnVpbGRPcHRpb25zLnN1YnJlc291cmNlSW50ZWdyaXR5ID8gJ2Fub255bW91cycgOiBmYWxzZVxuICAgIH0sXG4gICAgb3B0aW1pemF0aW9uOiB7XG4gICAgICBydW50aW1lQ2h1bms6ICdzaW5nbGUnLFxuICAgICAgc3BsaXRDaHVua3M6IHtcbiAgICAgICAgbWF4QXN5bmNSZXF1ZXN0czogSW5maW5pdHksXG4gICAgICAgIGNhY2hlR3JvdXBzOiB7XG4gICAgICAgICAgZGVmYXVsdDogYnVpbGRPcHRpb25zLmNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIGNodW5rczogJ2FzeW5jJyxcbiAgICAgICAgICAgIG1pbkNodW5rczogMixcbiAgICAgICAgICAgIHByaW9yaXR5OiAxMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbW1vbjogYnVpbGRPcHRpb25zLmNvbW1vbkNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICdjb21tb24nLFxuICAgICAgICAgICAgY2h1bmtzOiAnYXN5bmMnLFxuICAgICAgICAgICAgbWluQ2h1bmtzOiAyLFxuICAgICAgICAgICAgZW5mb3JjZTogdHJ1ZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiA1LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdmVuZG9yczogZmFsc2UsXG4gICAgICAgICAgdmVuZG9yOiBidWlsZE9wdGlvbnMudmVuZG9yQ2h1bmsgJiYge1xuICAgICAgICAgICAgbmFtZTogJ3ZlbmRvcicsXG4gICAgICAgICAgICBjaHVua3M6ICdpbml0aWFsJyxcbiAgICAgICAgICAgIGVuZm9yY2U6IHRydWUsXG4gICAgICAgICAgICB0ZXN0OiAobW9kdWxlOiBhbnksIGNodW5rczogQXJyYXk8eyBuYW1lOiBzdHJpbmcgfT4pID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgbW9kdWxlTmFtZSA9IG1vZHVsZS5uYW1lRm9yQ29uZGl0aW9uID8gbW9kdWxlLm5hbWVGb3JDb25kaXRpb24oKSA6ICcnO1xuICAgICAgICAgICAgICByZXR1cm4gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KG1vZHVsZU5hbWUpXG4gICAgICAgICAgICAgICAgJiYgIWNodW5rcy5zb21lKCh7IG5hbWUgfSkgPT4gbmFtZSA9PT0gJ3BvbHlmaWxscydcbiAgICAgICAgICAgICAgICAgIHx8IGdsb2JhbFN0eWxlc0J1bmRsZU5hbWVzLmluY2x1ZGVzKG5hbWUpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLmNvbmNhdChbXG4gICAgICBuZXcgSW5kZXhIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICAgIGlucHV0OiBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLmluZGV4KSxcbiAgICAgICAgb3V0cHV0OiBwYXRoLmJhc2VuYW1lKGJ1aWxkT3B0aW9ucy5pbmRleCksXG4gICAgICAgIGJhc2VIcmVmOiBidWlsZE9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgIGVudHJ5cG9pbnRzOiBnZW5lcmF0ZUVudHJ5UG9pbnRzKGJ1aWxkT3B0aW9ucyksXG4gICAgICAgIGRlcGxveVVybDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgICAgc3JpOiBidWlsZE9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHksXG4gICAgICB9KSxcbiAgICBdKSxcbiAgICBub2RlOiBmYWxzZSxcbiAgfTtcbn1cbiJdfQ==