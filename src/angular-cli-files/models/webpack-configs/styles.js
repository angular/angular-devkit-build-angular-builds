"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const webpack_1 = require("../../plugins/webpack");
const utils_1 = require("./utils");
const autoprefixer = require('autoprefixer');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const postcssImports = require('postcss-import');
/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 *
 * require('style-loader')
 * require('postcss-loader')
 * require('stylus')
 * require('stylus-loader')
 * require('less')
 * require('less-loader')
 * require('node-sass')
 * require('sass-loader')
 */
function getStylesConfig(wco) {
    const { root, buildOptions } = wco;
    const entryPoints = {};
    const globalStylePaths = [];
    const extraPlugins = [];
    const cssSourceMap = buildOptions.sourceMap.styles;
    // Determine hashing format.
    const hashFormat = utils_1.getOutputHashFormat(buildOptions.outputHashing);
    const postcssPluginCreator = function (loader) {
        return [
            postcssImports({
                resolve: (url) => url.startsWith('~') ? url.substr(1) : url,
                load: (filename) => {
                    return new Promise((resolve, reject) => {
                        loader.fs.readFile(filename, (err, data) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            const content = data.toString();
                            resolve(content);
                        });
                    });
                },
            }),
            webpack_1.PostcssCliResources({
                baseHref: buildOptions.baseHref,
                deployUrl: buildOptions.deployUrl,
                resourcesOutputPath: buildOptions.resourcesOutputPath,
                loader,
                rebaseRootRelative: buildOptions.rebaseRootRelativeCssUrls,
                filename: `[name]${hashFormat.file}.[ext]`,
            }),
            autoprefixer(),
        ];
    };
    // use includePaths from appConfig
    const includePaths = [];
    let lessPathOptions = {};
    if (buildOptions.stylePreprocessorOptions
        && buildOptions.stylePreprocessorOptions.includePaths
        && buildOptions.stylePreprocessorOptions.includePaths.length > 0) {
        buildOptions.stylePreprocessorOptions.includePaths.forEach((includePath) => includePaths.push(path.resolve(root, includePath)));
        lessPathOptions = {
            paths: includePaths,
        };
    }
    // Process global styles.
    if (buildOptions.styles.length > 0) {
        const chunkNames = [];
        utils_1.normalizeExtraEntryPoints(buildOptions.styles, 'styles').forEach(style => {
            const resolvedPath = path.resolve(root, style.input);
            // Add style entry points.
            if (entryPoints[style.bundleName]) {
                entryPoints[style.bundleName].push(resolvedPath);
            }
            else {
                entryPoints[style.bundleName] = [resolvedPath];
            }
            // Add lazy styles to the list.
            if (style.lazy) {
                chunkNames.push(style.bundleName);
            }
            // Add global css paths.
            globalStylePaths.push(resolvedPath);
        });
        if (chunkNames.length > 0) {
            // Add plugin to remove hashes from lazy styles.
            extraPlugins.push(new webpack_1.RemoveHashPlugin({ chunkNames, hashFormat }));
        }
    }
    let sassImplementation;
    let fiber;
    try {
        // tslint:disable-next-line:no-implicit-dependencies
        sassImplementation = require('node-sass');
    }
    catch (_a) {
        sassImplementation = require('sass');
        try {
            // tslint:disable-next-line:no-implicit-dependencies
            fiber = require('fibers');
        }
        catch (_b) { }
    }
    // set base rules to derive final rules from
    const baseRules = [
        { test: /\.css$/, use: [] },
        {
            test: /\.scss$|\.sass$/,
            use: [{
                    loader: 'sass-loader',
                    options: {
                        implementation: sassImplementation,
                        fiber,
                        sourceMap: cssSourceMap,
                        // bootstrap-sass requires a minimum precision of 8
                        precision: 8,
                        includePaths,
                    },
                }],
        },
        {
            test: /\.less$/,
            use: [{
                    loader: 'less-loader',
                    options: Object.assign({ sourceMap: cssSourceMap, javascriptEnabled: true }, lessPathOptions),
                }],
        },
        {
            test: /\.styl$/,
            use: [{
                    loader: 'stylus-loader',
                    options: {
                        sourceMap: cssSourceMap,
                        paths: includePaths,
                    },
                }],
        },
    ];
    // load component css as raw strings
    const rules = baseRules.map(({ test, use }) => ({
        exclude: globalStylePaths,
        test,
        use: [
            { loader: 'raw-loader' },
            {
                loader: 'postcss-loader',
                options: {
                    ident: 'embedded',
                    plugins: postcssPluginCreator,
                    sourceMap: cssSourceMap && !buildOptions.sourceMap.hidden ? 'inline' : false,
                },
            },
            ...use,
        ],
    }));
    // load global css as css files
    if (globalStylePaths.length > 0) {
        rules.push(...baseRules.map(({ test, use }) => {
            return {
                include: globalStylePaths,
                test,
                use: [
                    buildOptions.extractCss ? MiniCssExtractPlugin.loader : 'style-loader',
                    webpack_1.RawCssLoader,
                    {
                        loader: 'postcss-loader',
                        options: {
                            ident: buildOptions.extractCss ? 'extracted' : 'embedded',
                            plugins: postcssPluginCreator,
                            sourceMap: cssSourceMap
                                && !buildOptions.extractCss
                                && !buildOptions.sourceMap.hidden
                                ? 'inline' : cssSourceMap,
                        },
                    },
                    ...use,
                ],
            };
        }));
    }
    if (buildOptions.extractCss) {
        extraPlugins.push(
        // extract global css from js files into own css file
        new MiniCssExtractPlugin({ filename: `[name]${hashFormat.extract}.css` }), 
        // suppress empty .js files in css only entry points
        new webpack_1.SuppressExtractedTextChunksWebpackPlugin());
    }
    return {
        entry: entryPoints,
        module: { rules },
        plugins: extraPlugins,
    };
}
exports.getStylesConfig = getStylesConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOztBQUVILDZCQUE2QjtBQUU3QixtREFLK0I7QUFFL0IsbUNBQXlFO0FBRXpFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUM3QyxNQUFNLG9CQUFvQixHQUFHLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ2hFLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0FBRWpEOzs7Ozs7Ozs7Ozs7R0FZRztBQUVILFNBQWdCLGVBQWUsQ0FBQyxHQUF5QjtJQUN2RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUNuQyxNQUFNLFdBQVcsR0FBZ0MsRUFBRSxDQUFDO0lBQ3BELE1BQU0sZ0JBQWdCLEdBQWEsRUFBRSxDQUFDO0lBQ3RDLE1BQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQztJQUV4QixNQUFNLFlBQVksR0FBRyxZQUFZLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztJQUVuRCw0QkFBNEI7SUFDNUIsTUFBTSxVQUFVLEdBQUcsMkJBQW1CLENBQUMsWUFBWSxDQUFDLGFBQXVCLENBQUMsQ0FBQztJQUU3RSxNQUFNLG9CQUFvQixHQUFHLFVBQVUsTUFBb0M7UUFDekUsT0FBTztZQUNMLGNBQWMsQ0FBQztnQkFDYixPQUFPLEVBQUUsQ0FBQyxHQUFXLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUc7Z0JBQ25F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QVksQ0FBQyxTQUFTLENBQUMsTUFBTTtnQ0FDakMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsWUFBWTt5QkFDNUI7cUJBQ0Y7b0JBQ0QsR0FBSSxHQUF3QjtpQkFDN0I7YUFDRixDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNMO0lBRUQsSUFBSSxZQUFZLENBQUMsVUFBVSxFQUFFO1FBQzNCLFlBQVksQ0FBQyxJQUFJO1FBQ2YscURBQXFEO1FBQ3JELElBQUksb0JBQW9CLENBQUMsRUFBRSxRQUFRLEVBQUUsU0FBUyxVQUFVLENBQUMsT0FBTyxNQUFNLEVBQUUsQ0FBQztRQUN6RSxvREFBb0Q7UUFDcEQsSUFBSSxrREFBd0MsRUFBRSxDQUMvQyxDQUFDO0tBQ0g7SUFFRCxPQUFPO1FBQ0wsS0FBSyxFQUFFLFdBQVc7UUFDbEIsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFO1FBQ2pCLE9BQU8sRUFBRSxZQUFZO0tBQ3RCLENBQUM7QUFDSixDQUFDO0FBck1ELDBDQXFNQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQge1xuICBQb3N0Y3NzQ2xpUmVzb3VyY2VzLFxuICBSYXdDc3NMb2FkZXIsXG4gIFJlbW92ZUhhc2hQbHVnaW4sXG4gIFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4sXG59IGZyb20gJy4uLy4uL3BsdWdpbnMvd2VicGFjayc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgZ2V0T3V0cHV0SGFzaEZvcm1hdCwgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyB9IGZyb20gJy4vdXRpbHMnO1xuXG5jb25zdCBhdXRvcHJlZml4ZXIgPSByZXF1aXJlKCdhdXRvcHJlZml4ZXInKTtcbmNvbnN0IE1pbmlDc3NFeHRyYWN0UGx1Z2luID0gcmVxdWlyZSgnbWluaS1jc3MtZXh0cmFjdC1wbHVnaW4nKTtcbmNvbnN0IHBvc3Rjc3NJbXBvcnRzID0gcmVxdWlyZSgncG9zdGNzcy1pbXBvcnQnKTtcblxuLyoqXG4gKiBFbnVtZXJhdGUgbG9hZGVycyBhbmQgdGhlaXIgZGVwZW5kZW5jaWVzIGZyb20gdGhpcyBmaWxlIHRvIGxldCB0aGUgZGVwZW5kZW5jeSB2YWxpZGF0b3JcbiAqIGtub3cgdGhleSBhcmUgdXNlZC5cbiAqXG4gKiByZXF1aXJlKCdzdHlsZS1sb2FkZXInKVxuICogcmVxdWlyZSgncG9zdGNzcy1sb2FkZXInKVxuICogcmVxdWlyZSgnc3R5bHVzJylcbiAqIHJlcXVpcmUoJ3N0eWx1cy1sb2FkZXInKVxuICogcmVxdWlyZSgnbGVzcycpXG4gKiByZXF1aXJlKCdsZXNzLWxvYWRlcicpXG4gKiByZXF1aXJlKCdub2RlLXNhc3MnKVxuICogcmVxdWlyZSgnc2Fzcy1sb2FkZXInKVxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdHlsZXNDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuICBjb25zdCB7IHJvb3QsIGJ1aWxkT3B0aW9ucyB9ID0gd2NvO1xuICBjb25zdCBlbnRyeVBvaW50czogeyBba2V5OiBzdHJpbmddOiBzdHJpbmdbXSB9ID0ge307XG4gIGNvbnN0IGdsb2JhbFN0eWxlUGF0aHM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGV4dHJhUGx1Z2lucyA9IFtdO1xuXG4gIGNvbnN0IGNzc1NvdXJjZU1hcCA9IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAuc3R5bGVzO1xuXG4gIC8vIERldGVybWluZSBoYXNoaW5nIGZvcm1hdC5cbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcgYXMgc3RyaW5nKTtcblxuICBjb25zdCBwb3N0Y3NzUGx1Z2luQ3JlYXRvciA9IGZ1bmN0aW9uIChsb2FkZXI6IHdlYnBhY2subG9hZGVyLkxvYWRlckNvbnRleHQpIHtcbiAgICByZXR1cm4gW1xuICAgICAgcG9zdGNzc0ltcG9ydHMoe1xuICAgICAgICByZXNvbHZlOiAodXJsOiBzdHJpbmcpID0+IHVybC5zdGFydHNXaXRoKCd+JykgPyB1cmwuc3Vic3RyKDEpIDogdXJsLFxuICAgICAgICBsb2FkOiAoZmlsZW5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGxvYWRlci5mcy5yZWFkRmlsZShmaWxlbmFtZSwgKGVycjogRXJyb3IsIGRhdGE6IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgICAgICAgICByZXNvbHZlKGNvbnRlbnQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIFBvc3Rjc3NDbGlSZXNvdXJjZXMoe1xuICAgICAgICBiYXNlSHJlZjogYnVpbGRPcHRpb25zLmJhc2VIcmVmLFxuICAgICAgICBkZXBsb3lVcmw6IGJ1aWxkT3B0aW9ucy5kZXBsb3lVcmwsXG4gICAgICAgIHJlc291cmNlc091dHB1dFBhdGg6IGJ1aWxkT3B0aW9ucy5yZXNvdXJjZXNPdXRwdXRQYXRoLFxuICAgICAgICBsb2FkZXIsXG4gICAgICAgIHJlYmFzZVJvb3RSZWxhdGl2ZTogYnVpbGRPcHRpb25zLnJlYmFzZVJvb3RSZWxhdGl2ZUNzc1VybHMsXG4gICAgICAgIGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmZpbGV9LltleHRdYCxcbiAgICAgIH0pLFxuICAgICAgYXV0b3ByZWZpeGVyKCksXG4gICAgXTtcbiAgfTtcblxuICAvLyB1c2UgaW5jbHVkZVBhdGhzIGZyb20gYXBwQ29uZmlnXG4gIGNvbnN0IGluY2x1ZGVQYXRoczogc3RyaW5nW10gPSBbXTtcbiAgbGV0IGxlc3NQYXRoT3B0aW9uczogeyBwYXRocz86IHN0cmluZ1tdIH0gPSB7fTtcblxuICBpZiAoYnVpbGRPcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9uc1xuICAgICYmIGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMuaW5jbHVkZVBhdGhzXG4gICAgJiYgYnVpbGRPcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucy5pbmNsdWRlUGF0aHMubGVuZ3RoID4gMFxuICApIHtcbiAgICBidWlsZE9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLmluY2x1ZGVQYXRocy5mb3JFYWNoKChpbmNsdWRlUGF0aDogc3RyaW5nKSA9PlxuICAgICAgaW5jbHVkZVBhdGhzLnB1c2gocGF0aC5yZXNvbHZlKHJvb3QsIGluY2x1ZGVQYXRoKSkpO1xuICAgIGxlc3NQYXRoT3B0aW9ucyA9IHtcbiAgICAgIHBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgfTtcbiAgfVxuXG4gIC8vIFByb2Nlc3MgZ2xvYmFsIHN0eWxlcy5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdHlsZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGNodW5rTmFtZXM6IHN0cmluZ1tdID0gW107XG5cbiAgICBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKGJ1aWxkT3B0aW9ucy5zdHlsZXMsICdzdHlsZXMnKS5mb3JFYWNoKHN0eWxlID0+IHtcbiAgICAgIGNvbnN0IHJlc29sdmVkUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBzdHlsZS5pbnB1dCk7XG4gICAgICAvLyBBZGQgc3R5bGUgZW50cnkgcG9pbnRzLlxuICAgICAgaWYgKGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdKSB7XG4gICAgICAgIGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdLnB1c2gocmVzb2x2ZWRQYXRoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdID0gW3Jlc29sdmVkUGF0aF07XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCBsYXp5IHN0eWxlcyB0byB0aGUgbGlzdC5cbiAgICAgIGlmIChzdHlsZS5sYXp5KSB7XG4gICAgICAgIGNodW5rTmFtZXMucHVzaChzdHlsZS5idW5kbGVOYW1lKTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIGdsb2JhbCBjc3MgcGF0aHMuXG4gICAgICBnbG9iYWxTdHlsZVBhdGhzLnB1c2gocmVzb2x2ZWRQYXRoKTtcbiAgICB9KTtcblxuICAgIGlmIChjaHVua05hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIEFkZCBwbHVnaW4gdG8gcmVtb3ZlIGhhc2hlcyBmcm9tIGxhenkgc3R5bGVzLlxuICAgICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFJlbW92ZUhhc2hQbHVnaW4oeyBjaHVua05hbWVzLCBoYXNoRm9ybWF0IH0pKTtcbiAgICB9XG4gIH1cblxuICBsZXQgc2Fzc0ltcGxlbWVudGF0aW9uOiB7fSB8IHVuZGVmaW5lZDtcbiAgbGV0IGZpYmVyOiB7fSB8IHVuZGVmaW5lZDtcbiAgdHJ5IHtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG4gICAgc2Fzc0ltcGxlbWVudGF0aW9uID0gcmVxdWlyZSgnbm9kZS1zYXNzJyk7XG4gIH0gY2F0Y2gge1xuICAgIHNhc3NJbXBsZW1lbnRhdGlvbiA9IHJlcXVpcmUoJ3Nhc3MnKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG4gICAgICBmaWJlciA9IHJlcXVpcmUoJ2ZpYmVycycpO1xuICAgIH0gY2F0Y2ggeyB9XG4gIH1cblxuICAvLyBzZXQgYmFzZSBydWxlcyB0byBkZXJpdmUgZmluYWwgcnVsZXMgZnJvbVxuICBjb25zdCBiYXNlUnVsZXM6IHdlYnBhY2suUnVsZVNldFJ1bGVbXSA9IFtcbiAgICB7IHRlc3Q6IC9cXC5jc3MkLywgdXNlOiBbXSB9LFxuICAgIHtcbiAgICAgIHRlc3Q6IC9cXC5zY3NzJHxcXC5zYXNzJC8sXG4gICAgICB1c2U6IFt7XG4gICAgICAgIGxvYWRlcjogJ3Nhc3MtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIGltcGxlbWVudGF0aW9uOiBzYXNzSW1wbGVtZW50YXRpb24sXG4gICAgICAgICAgZmliZXIsXG4gICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgLy8gYm9vdHN0cmFwLXNhc3MgcmVxdWlyZXMgYSBtaW5pbXVtIHByZWNpc2lvbiBvZiA4XG4gICAgICAgICAgcHJlY2lzaW9uOiA4LFxuICAgICAgICAgIGluY2x1ZGVQYXRocyxcbiAgICAgICAgfSxcbiAgICAgIH1dLFxuICAgIH0sXG4gICAge1xuICAgICAgdGVzdDogL1xcLmxlc3MkLyxcbiAgICAgIHVzZTogW3tcbiAgICAgICAgbG9hZGVyOiAnbGVzcy1sb2FkZXInLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgamF2YXNjcmlwdEVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgLi4ubGVzc1BhdGhPcHRpb25zLFxuICAgICAgICB9LFxuICAgICAgfV0sXG4gICAgfSxcbiAgICB7XG4gICAgICB0ZXN0OiAvXFwuc3R5bCQvLFxuICAgICAgdXNlOiBbe1xuICAgICAgICBsb2FkZXI6ICdzdHlsdXMtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIHBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgICAgIH0sXG4gICAgICB9XSxcbiAgICB9LFxuICBdO1xuXG4gIC8vIGxvYWQgY29tcG9uZW50IGNzcyBhcyByYXcgc3RyaW5nc1xuICBjb25zdCBydWxlczogd2VicGFjay5SdWxlU2V0UnVsZVtdID0gYmFzZVJ1bGVzLm1hcCgoeyB0ZXN0LCB1c2UgfSkgPT4gKHtcbiAgICBleGNsdWRlOiBnbG9iYWxTdHlsZVBhdGhzLFxuICAgIHRlc3QsXG4gICAgdXNlOiBbXG4gICAgICB7IGxvYWRlcjogJ3Jhdy1sb2FkZXInIH0sXG4gICAgICB7XG4gICAgICAgIGxvYWRlcjogJ3Bvc3Rjc3MtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIGlkZW50OiAnZW1iZWRkZWQnLFxuICAgICAgICAgIHBsdWdpbnM6IHBvc3Rjc3NQbHVnaW5DcmVhdG9yLFxuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwICYmICFidWlsZE9wdGlvbnMuc291cmNlTWFwLmhpZGRlbiA/ICdpbmxpbmUnIDogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgLi4uKHVzZSBhcyB3ZWJwYWNrLkxvYWRlcltdKSxcbiAgICBdLFxuICB9KSk7XG5cbiAgLy8gbG9hZCBnbG9iYWwgY3NzIGFzIGNzcyBmaWxlc1xuICBpZiAoZ2xvYmFsU3R5bGVQYXRocy5sZW5ndGggPiAwKSB7XG4gICAgcnVsZXMucHVzaCguLi5iYXNlUnVsZXMubWFwKCh7IHRlc3QsIHVzZSB9KSA9PiB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBpbmNsdWRlOiBnbG9iYWxTdHlsZVBhdGhzLFxuICAgICAgICB0ZXN0LFxuICAgICAgICB1c2U6IFtcbiAgICAgICAgICBidWlsZE9wdGlvbnMuZXh0cmFjdENzcyA/IE1pbmlDc3NFeHRyYWN0UGx1Z2luLmxvYWRlciA6ICdzdHlsZS1sb2FkZXInLFxuICAgICAgICAgIFJhd0Nzc0xvYWRlcixcbiAgICAgICAgICB7XG4gICAgICAgICAgICBsb2FkZXI6ICdwb3N0Y3NzLWxvYWRlcicsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGlkZW50OiBidWlsZE9wdGlvbnMuZXh0cmFjdENzcyA/ICdleHRyYWN0ZWQnIDogJ2VtYmVkZGVkJyxcbiAgICAgICAgICAgICAgcGx1Z2luczogcG9zdGNzc1BsdWdpbkNyZWF0b3IsXG4gICAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwXG4gICAgICAgICAgICAgICAgJiYgIWJ1aWxkT3B0aW9ucy5leHRyYWN0Q3NzXG4gICAgICAgICAgICAgICAgJiYgIWJ1aWxkT3B0aW9ucy5zb3VyY2VNYXAuaGlkZGVuXG4gICAgICAgICAgICAgICAgPyAnaW5saW5lJyA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICAuLi4odXNlIGFzIHdlYnBhY2suTG9hZGVyW10pLFxuICAgICAgICBdLFxuICAgICAgfTtcbiAgICB9KSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RDc3MpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIC8vIGV4dHJhY3QgZ2xvYmFsIGNzcyBmcm9tIGpzIGZpbGVzIGludG8gb3duIGNzcyBmaWxlXG4gICAgICBuZXcgTWluaUNzc0V4dHJhY3RQbHVnaW4oeyBmaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5leHRyYWN0fS5jc3NgIH0pLFxuICAgICAgLy8gc3VwcHJlc3MgZW1wdHkgLmpzIGZpbGVzIGluIGNzcyBvbmx5IGVudHJ5IHBvaW50c1xuICAgICAgbmV3IFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4oKSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgbW9kdWxlOiB7IHJ1bGVzIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICB9O1xufVxuIl19