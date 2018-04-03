"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
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
        .map(entry => {
        if (!entry.bundleName) {
            return core_1.basename(core_1.normalize(entry.input.replace(/\.(js|css|scss|sass|less|styl)$/i, '')));
        }
        else {
            return entry.bundleName;
        }
    });
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
        .map(style => {
        if (style.bundleName) {
            return style.bundleName;
        }
        else if (style.lazy) {
            return core_1.basename(core_1.normalize(style.input.replace(/\.(js|css|scss|sass|less|styl)$/i, '')));
        }
        else {
            return 'styles';
        }
    });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3Nlci5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncy9icm93c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxpQkFBaUI7QUFDakIsK0RBQStEOztBQUUvRCwrQ0FBMkQ7QUFDM0QsNkJBQTZCO0FBQzdCLE1BQU0saUJBQWlCLEdBQUcsT0FBTyxDQUFDLHFCQUFxQixDQUFDLENBQUM7QUFDekQsTUFBTSwwQkFBMEIsR0FBRyxPQUFPLENBQUMsK0JBQStCLENBQUMsQ0FBQztBQUM1RSxtRUFBOEQ7QUFDOUQsMkVBQTJGO0FBQzNGLG1FQUFvRTtBQUNwRSx1RkFBaUY7QUFJakY7Ozs7O0lBS0k7QUFFSiwwQkFBaUMsR0FBeUI7SUFDeEQsTUFBTSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBR2hELElBQUksWUFBWSxHQUFVLEVBQUUsQ0FBQztJQUU3QixxREFBcUQ7SUFDckQsTUFBTSxvQkFBb0IsR0FBSSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sRUFBRSxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQXVCO1NBQ2xHLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7U0FDM0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ1gsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUN0QixNQUFNLENBQUMsZUFBUSxDQUNiLGdCQUFTLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsa0NBQWtDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FDdkUsQ0FBQztRQUNKLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLE1BQU0sQ0FBQyxLQUFL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RUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsS0FBSyxDQUFDO2dCQUM3QyxNQUFNLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO2dCQUN6QyxRQUFRLEVBQUUsWUFBWSxDQUFDLFFBQVE7Z0JBQy9CLFdBQVcsRUFBRSx3Q0FBbUIsQ0FBQyxZQUFZLENBQUM7Z0JBQzlDLFNBQVMsRUFBRSxZQUFZLENBQUMsU0FBUzthQUNsQyxDQUFDO1NBQ0gsQ0FBQztRQUNGLElBQUksRUFBRSxLQUFLO0tBQ1osQ0FBQztBQUNKLENBQUM7QUF2SEQsNENBdUhDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgeyBiYXNlbmFtZSwgbm9ybWFsaXplIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmNvbnN0IEh0bWxXZWJwYWNrUGx1Z2luID0gcmVxdWlyZSgnaHRtbC13ZWJwYWNrLXBsdWdpbicpO1xuY29uc3QgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4gPSByZXF1aXJlKCd3ZWJwYWNrLXN1YnJlc291cmNlLWludGVncml0eScpO1xuaW1wb3J0IHsgTGljZW5zZVdlYnBhY2tQbHVnaW4gfSBmcm9tICdsaWNlbnNlLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IGdlbmVyYXRlRW50cnlQb2ludHMsIHBhY2thZ2VDaHVua1NvcnQgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvcGFja2FnZS1jaHVuay1zb3J0JztcbmltcG9ydCB7IEJhc2VIcmVmV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL2xpYi9iYXNlLWhyZWYtd2VicGFjayc7XG5pbXBvcnQgeyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luJztcbmltcG9ydCB7IEV4dHJhRW50cnlQb2ludCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXInO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcblxuLyoqXG4rICogbGljZW5zZS13ZWJwYWNrLXBsdWdpbiBoYXMgYSBwZWVyIGRlcGVuZGVuY3kgb24gd2VicGFjay1zb3VyY2VzLCBsaXN0IGl0IGluIGEgY29tbWVudCB0b1xuKyAqIGxldCB0aGUgZGVwZW5kZW5jeSB2YWxpZGF0b3Iga25vdyBpdCBpcyB1c2VkLlxuKyAqXG4rICogcmVxdWlyZSgnd2VicGFjay1zb3VyY2VzJylcbisgKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJyb3dzZXJDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuICBjb25zdCB7IHJvb3QsIHByb2plY3RSb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcblxuXG4gIGxldCBleHRyYVBsdWdpbnM6IGFueVtdID0gW107XG5cbiAgLy8gRmlndXJlIG91dCB3aGljaCBhcmUgdGhlIGxhenkgbG9hZGVkIGJ1bmRsZSBuYW1lcy5cbiAgY29uc3QgbGF6eUNodW5rQnVuZGxlTmFtZXMgPSAoWy4uLmJ1aWxkT3B0aW9ucy5zdHlsZXMsIC4uLmJ1aWxkT3B0aW9ucy5zY3JpcHRzXSBhcyBFeHRyYUVudHJ5UG9pbnRbXSlcbiAgICAuZmlsdGVyKGVudHJ5ID0+IGVudHJ5LmxhenkpXG4gICAgLm1hcChlbnRyeSA9PiB7XG4gICAgICBpZiAoIWVudHJ5LmJ1bmRsZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGJhc2VuYW1lKFxuICAgICAgICAgIG5vcm1hbGl6ZShlbnRyeS5pbnB1dC5yZXBsYWNlKC9cXC4oanN8Y3NzfHNjc3N8c2Fzc3xsZXNzfHN0eWwpJC9pLCAnJykpLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGVudHJ5LmJ1bmRsZU5hbWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgY29uc3QgZ2VuZXJhdGVJbmRleEh0bWwgPSBmYWxzZTtcbiAgaWYgKGdlbmVyYXRlSW5kZXhIdG1sKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IEh0bWxXZWJwYWNrUGx1Z2luKHtcbiAgICAgIHRlbXBsYXRlOiBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLmluZGV4KSxcbiAgICAgIGZpbGVuYW1lOiBwYXRoLnJlc29sdmUoYnVpbGRPcHRpb25zLm91dHB1dFBhdGgsIGJ1aWxkT3B0aW9ucy5pbmRleCksXG4gICAgICBjaHVua3NTb3J0TW9kZTogcGFja2FnZUNodW5rU29ydChidWlsZE9wdGlvbnMpLFxuICAgICAgZXhjbHVkZUNodW5rczogbGF6eUNodW5rQnVuZGxlTmFtZXMsXG4gICAgICB4aHRtbDogdHJ1ZSxcbiAgICAgIG1pbmlmeTogYnVpbGRPcHRpb25zLm9wdGltaXphdGlvbiA/IHtcbiAgICAgICAgY2FzZVNlbnNpdGl2ZTogdHJ1ZSxcbiAgICAgICAgY29sbGFwc2VXaGl0ZXNwYWNlOiB0cnVlLFxuICAgICAgICBrZWVwQ2xvc2luZ1NsYXNoOiB0cnVlXG4gICAgICB9IDogZmFsc2VcbiAgICB9KSk7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IEJhc2VIcmVmV2VicGFja1BsdWdpbih7XG4gICAgICBiYXNlSHJlZjogYnVpbGRPcHRpb25zLmJhc2VIcmVmIGFzIHN0cmluZ1xuICAgIH0pKTtcbiAgfVxuXG4gIGxldCBzb3VyY2VtYXBzOiBzdHJpbmcgfCBmYWxzZSA9IGZhbHNlO1xuICBpZiAoYnVpbGRPcHRpb25zLnNvdXJjZU1hcCkge1xuICAgIC8vIFNlZSBodHRwczovL3dlYnBhY2suanMub3JnL2NvbmZpZ3VyYXRpb24vZGV2dG9vbC8gZm9yIHNvdXJjZW1hcCB0eXBlcy5cbiAgICBpZiAoYnVpbGRPcHRpb25zLmV2YWxTb3VyY2VNYXAgJiYgIWJ1aWxkT3B0aW9ucy5vcHRpbWl6YXRpb24pIHtcbiAgICAgIC8vIFByb2R1Y2UgZXZhbCBzb3VyY2VtYXBzIGZvciBkZXZlbG9wbWVudCB3aXRoIHNlcnZlLCB3aGljaCBhcmUgZmFzdGVyLlxuICAgICAgc291cmNlbWFwcyA9ICdldmFsJztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUHJvZHVjZSBmdWxsIHNlcGFyYXRlIHNvdXJjZW1hcHMgZm9yIHByb2R1Y3Rpb24uXG4gICAgICBzb3VyY2VtYXBzID0gJ3NvdXJjZS1tYXAnO1xuICAgIH1cbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHkpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgU3VicmVzb3VyY2VJbnRlZ3JpdHlQbHVnaW4oe1xuICAgICAgaGFzaEZ1bmNOYW1lczogWydzaGEzODQnXVxuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IExpY2Vuc2VXZWJwYWNrUGx1Z2luKHtcbiAgICAgIHBhdHRlcm46IC8uKi8sXG4gICAgICBzdXBwcmVzc0Vycm9yczogdHJ1ZSxcbiAgICAgIHBlckNodW5rT3V0cHV0OiBmYWxzZSxcbiAgICAgIG91dHB1dEZpbGVuYW1lOiBgM3JkcGFydHlsaWNlbnNlcy50eHRgXG4gICAgfSkpO1xuICB9XG5cbiAgY29uc3QgZ2xvYmFsU3R5bGVzQnVuZGxlTmFtZXMgPSAoYnVpbGRPcHRpb25zLnN0eWxlcyBhcyBFeHRyYUVudHJ5UG9pbnRbXSlcbiAgICAubWFwKHN0eWxlID0+IHtcbiAgICAgIGlmIChzdHlsZS5idW5kbGVOYW1lKSB7XG4gICAgICAgIHJldHVybiBzdHlsZS5idW5kbGVOYW1lO1xuICAgICAgfSBlbHNlIGlmIChzdHlsZS5sYXp5KSB7XG4gICAgICAgIHJldHVybiBiYXNlbmFtZShcbiAgICAgICAgICBub3JtYWxpemUoc3R5bGUuaW5wdXQucmVwbGFjZSgvXFwuKGpzfGNzc3xzY3NzfHNhc3N8bGVzc3xzdHlsKSQvaSwgJycpKSxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnc3R5bGVzJztcbiAgICAgIH1cbiAgICB9KTtcblxuICByZXR1cm4ge1xuICAgIGRldnRvb2w6IHNvdXJjZW1hcHMsXG4gICAgcmVzb2x2ZToge1xuICAgICAgbWFpbkZpZWxkczogW1xuICAgICAgICAuLi4od2NvLnN1cHBvcnRFUzIwMTUgPyBbJ2VzMjAxNSddIDogW10pLFxuICAgICAgICAnYnJvd3NlcicsICdtb2R1bGUnLCAnbWFpbidcbiAgICAgIF1cbiAgICB9LFxuICAgIG91dHB1dDoge1xuICAgICAgY3Jvc3NPcmlnaW5Mb2FkaW5nOiBidWlsZE9wdGlvbnMuc3VicmVzb3VyY2VJbnRlZ3JpdHkgPyAnYW5vbnltb3VzJyA6IGZhbHNlXG4gICAgfSxcbiAgICBvcHRpbWl6YXRpb246IHtcbiAgICAgIHJ1bnRpbWVDaHVuazogJ3NpbmdsZScsXG4gICAgICBzcGxpdENodW5rczoge1xuICAgICAgICBjaHVua3M6IGJ1aWxkT3B0aW9ucy5jb21tb25DaHVuayA/ICdhbGwnIDogJ2luaXRpYWwnLFxuICAgICAgICBjYWNoZUdyb3Vwczoge1xuICAgICAgICAgIHZlbmRvcnM6IGZhbHNlLFxuICAgICAgICAgIHZlbmRvcjogYnVpbGRPcHRpb25zLnZlbmRvckNodW5rICYmIHtcbiAgICAgICAgICAgIG5hbWU6ICd2ZW5kb3InLFxuICAgICAgICAgICAgY2h1bmtzOiAnaW5pdGlhbCcsXG4gICAgICAgICAgICB0ZXN0OiAobW9kdWxlOiBhbnksIGNodW5rczogQXJyYXk8eyBuYW1lOiBzdHJpbmcgfT4pID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgbW9kdWxlTmFtZSA9IG1vZHVsZS5uYW1lRm9yQ29uZGl0aW9uID8gbW9kdWxlLm5hbWVGb3JDb25kaXRpb24oKSA6ICcnO1xuICAgICAgICAgICAgICByZXR1cm4gL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dLy50ZXN0KG1vZHVsZU5hbWUpXG4gICAgICAgICAgICAgICAgJiYgIWNodW5rcy5zb21lKCh7IG5hbWUgfSkgPT4gbmFtZSA9PT0gJ3BvbHlmaWxscydcbiAgICAgICAgICAgICAgICAgIHx8IGdsb2JhbFN0eWxlc0J1bmRsZU5hbWVzLmluY2x1ZGVzKG5hbWUpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLmNvbmNhdChbXG4gICAgICBuZXcgSW5kZXhIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICAgIGlucHV0OiBwYXRoLnJlc29sdmUocm9vdCwgYnVpbGRPcHRpb25zLmluZGV4KSxcbiAgICAgICAgb3V0cHV0OiBwYXRoLmJhc2VuYW1lKGJ1aWxkT3B0aW9ucy5pbmRleCksXG4gICAgICAgIGJhc2VIcmVmOiBidWlsZE9wdGlvbnMuYmFzZUhyZWYsXG4gICAgICAgIGVudHJ5cG9pbnRzOiBnZW5lcmF0ZUVudHJ5UG9pbnRzKGJ1aWxkT3B0aW9ucyksXG4gICAgICAgIGRlcGxveVVybDogYnVpbGRPcHRpb25zLmRlcGxveVVybCxcbiAgICAgIH0pLFxuICAgIF0pLFxuICAgIG5vZGU6IGZhbHNlLFxuICB9O1xufVxuIl19