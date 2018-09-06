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
    const cssSourceMap = buildOptions.sourceMap;
    // Determine hashing format.
    const hashFormat = utils_1.getOutputHashFormat(buildOptions.outputHashing);
    // Convert absolute resource URLs to account for base-href and deploy-url.
    const baseHref = wco.buildOptions.baseHref || '';
    const deployUrl = wco.buildOptions.deployUrl || '';
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
                baseHref,
                deployUrl,
                loader,
                filename: `[name]${hashFormat.file}.[ext]`,
            }),
            autoprefixer({ grid: true }),
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
    let dartSass;
    try {
        // tslint:disable-next-line:no-implicit-dependencies
        dartSass = require('sass');
    }
    catch (_a) { }
    let fiber;
    if (dartSass) {
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
                        implementation: dartSass,
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
                    sourceMap: cssSourceMap ? 'inline' : false,
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
                            sourceMap: cssSourceMap && !buildOptions.extractCss ? 'inline' : cssSourceMap,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOztBQUVILDZCQUE2QjtBQUU3QixtREFLK0I7QUFFL0IsbUNBQXlFO0FBRXpFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUM3QyxNQUFNLG9CQUFvQixHQUFHLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ2hFLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0FBRWpEOzs7Ozs7Ozs7Ozs7R0FZRztBQUVILFNBQWdCLGVBQWUsQ0FBQyxHQUF5QjtJQUN2RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUNuQyxNQUFNLFdBQVcsR0FBZ0MsRUFBRSxDQUFDO0lBQ3BELE1BQU0sZ0JBQWdCLEdBQWEsRUFBRSxDQUFDO0lBQ3RDLE1BQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQztJQUN4QixNQUFNLFlBQVksR0FBRyxZQUFZLENBQUMsU0FBUyxDQUFDO0lBRTVDLDRCQUE0QjtJQUM1QixNQUFNLFVBQVUsR0FBRywyQkFBbUIsQ0FBQyxZQUFZLENBQUMsYUFBdUIsQ0FBQyxDQUFDO0lBQzdFLDBFQUEwRTtJQUMxRSxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsWUFBWSxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUM7SUFDakQsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxTQUFTLElBQUksRUFBRSxDQUFDO0lBRW5ELE1BQU0sb0JBQW9CLEdBQUcsVUFBVSxNQUFvQztRQUN6RSxPQUFPO1lBQ0wsY0FBYyxDQUFDO2dCQUNiLE9BQU8sRUFBRSxD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QUMsWUFBWTt5QkFDOUU7cUJBQ0Y7b0JBQ0QsR0FBSSxHQUF3QjtpQkFDN0I7YUFDRixDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNMO0lBRUQsSUFBSSxZQUFZLENBQUMsVUFBVSxFQUFFO1FBQzNCLFlBQVksQ0FBQyxJQUFJO1FBQ2YscURBQXFEO1FBQ3JELElBQUksb0JBQW9CLENBQUMsRUFBRSxRQUFRLEVBQUUsU0FBUyxVQUFVLENBQUMsT0FBTyxNQUFNLEVBQUUsQ0FBQztRQUN6RSxvREFBb0Q7UUFDcEQsSUFBSSxrREFBd0MsRUFBRSxDQUMvQyxDQUFDO0tBQ0g7SUFFRCxPQUFPO1FBQ0wsS0FBSyxFQUFFLFdBQVc7UUFDbEIsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFO1FBQ2pCLE9BQU8sRUFBRSxZQUFZO0tBQ3RCLENBQUM7QUFDSixDQUFDO0FBbE1ELDBDQWtNQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQge1xuICBQb3N0Y3NzQ2xpUmVzb3VyY2VzLFxuICBSYXdDc3NMb2FkZXIsXG4gIFJlbW92ZUhhc2hQbHVnaW4sXG4gIFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4sXG59IGZyb20gJy4uLy4uL3BsdWdpbnMvd2VicGFjayc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgZ2V0T3V0cHV0SGFzaEZvcm1hdCwgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyB9IGZyb20gJy4vdXRpbHMnO1xuXG5jb25zdCBhdXRvcHJlZml4ZXIgPSByZXF1aXJlKCdhdXRvcHJlZml4ZXInKTtcbmNvbnN0IE1pbmlDc3NFeHRyYWN0UGx1Z2luID0gcmVxdWlyZSgnbWluaS1jc3MtZXh0cmFjdC1wbHVnaW4nKTtcbmNvbnN0IHBvc3Rjc3NJbXBvcnRzID0gcmVxdWlyZSgncG9zdGNzcy1pbXBvcnQnKTtcblxuLyoqXG4gKiBFbnVtZXJhdGUgbG9hZGVycyBhbmQgdGhlaXIgZGVwZW5kZW5jaWVzIGZyb20gdGhpcyBmaWxlIHRvIGxldCB0aGUgZGVwZW5kZW5jeSB2YWxpZGF0b3JcbiAqIGtub3cgdGhleSBhcmUgdXNlZC5cbiAqXG4gKiByZXF1aXJlKCdzdHlsZS1sb2FkZXInKVxuICogcmVxdWlyZSgncG9zdGNzcy1sb2FkZXInKVxuICogcmVxdWlyZSgnc3R5bHVzJylcbiAqIHJlcXVpcmUoJ3N0eWx1cy1sb2FkZXInKVxuICogcmVxdWlyZSgnbGVzcycpXG4gKiByZXF1aXJlKCdsZXNzLWxvYWRlcicpXG4gKiByZXF1aXJlKCdub2RlLXNhc3MnKVxuICogcmVxdWlyZSgnc2Fzcy1sb2FkZXInKVxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdHlsZXNDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuICBjb25zdCB7IHJvb3QsIGJ1aWxkT3B0aW9ucyB9ID0gd2NvO1xuICBjb25zdCBlbnRyeVBvaW50czogeyBba2V5OiBzdHJpbmddOiBzdHJpbmdbXSB9ID0ge307XG4gIGNvbnN0IGdsb2JhbFN0eWxlUGF0aHM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGV4dHJhUGx1Z2lucyA9IFtdO1xuICBjb25zdCBjc3NTb3VyY2VNYXAgPSBidWlsZE9wdGlvbnMuc291cmNlTWFwO1xuXG4gIC8vIERldGVybWluZSBoYXNoaW5nIGZvcm1hdC5cbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcgYXMgc3RyaW5nKTtcbiAgLy8gQ29udmVydCBhYnNvbHV0ZSByZXNvdXJjZSBVUkxzIHRvIGFjY291bnQgZm9yIGJhc2UtaHJlZiBhbmQgZGVwbG95LXVybC5cbiAgY29uc3QgYmFzZUhyZWYgPSB3Y28uYnVpbGRPcHRpb25zLmJhc2VIcmVmIHx8ICcnO1xuICBjb25zdCBkZXBsb3lVcmwgPSB3Y28uYnVpbGRPcHRpb25zLmRlcGxveVVybCB8fCAnJztcblxuICBjb25zdCBwb3N0Y3NzUGx1Z2luQ3JlYXRvciA9IGZ1bmN0aW9uIChsb2FkZXI6IHdlYnBhY2subG9hZGVyLkxvYWRlckNvbnRleHQpIHtcbiAgICByZXR1cm4gW1xuICAgICAgcG9zdGNzc0ltcG9ydHMoe1xuICAgICAgICByZXNvbHZlOiAodXJsOiBzdHJpbmcpID0+IHVybC5zdGFydHNXaXRoKCd+JykgPyB1cmwuc3Vic3RyKDEpIDogdXJsLFxuICAgICAgICBsb2FkOiAoZmlsZW5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGxvYWRlci5mcy5yZWFkRmlsZShmaWxlbmFtZSwgKGVycjogRXJyb3IsIGRhdGE6IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgICAgICAgICByZXNvbHZlKGNvbnRlbnQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIFBvc3Rjc3NDbGlSZXNvdXJjZXMoe1xuICAgICAgICBiYXNlSHJlZixcbiAgICAgICAgZGVwbG95VXJsLFxuICAgICAgICBsb2FkZXIsXG4gICAgICAgIGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmZpbGV9LltleHRdYCxcbiAgICAgIH0pLFxuICAgICAgYXV0b3ByZWZpeGVyKHsgZ3JpZDogdHJ1ZSB9KSxcbiAgICBdO1xuICB9O1xuXG4gIC8vIHVzZSBpbmNsdWRlUGF0aHMgZnJvbSBhcHBDb25maWdcbiAgY29uc3QgaW5jbHVkZVBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuICBsZXQgbGVzc1BhdGhPcHRpb25zOiB7IHBhdGhzPzogc3RyaW5nW10gfSA9IHt9O1xuXG4gIGlmIChidWlsZE9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zXG4gICAgJiYgYnVpbGRPcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucy5pbmNsdWRlUGF0aHNcbiAgICAmJiBidWlsZE9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLmluY2x1ZGVQYXRocy5sZW5ndGggPiAwXG4gICkge1xuICAgIGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMuaW5jbHVkZVBhdGhzLmZvckVhY2goKGluY2x1ZGVQYXRoOiBzdHJpbmcpID0+XG4gICAgICBpbmNsdWRlUGF0aHMucHVzaChwYXRoLnJlc29sdmUocm9vdCwgaW5jbHVkZVBhdGgpKSk7XG4gICAgbGVzc1BhdGhPcHRpb25zID0ge1xuICAgICAgcGF0aHM6IGluY2x1ZGVQYXRocyxcbiAgICB9O1xuICB9XG5cbiAgLy8gUHJvY2VzcyBnbG9iYWwgc3R5bGVzLlxuICBpZiAoYnVpbGRPcHRpb25zLnN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgY2h1bmtOYW1lczogc3RyaW5nW10gPSBbXTtcblxuICAgIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoYnVpbGRPcHRpb25zLnN0eWxlcywgJ3N0eWxlcycpLmZvckVhY2goc3R5bGUgPT4ge1xuICAgICAgY29uc3QgcmVzb2x2ZWRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIHN0eWxlLmlucHV0KTtcbiAgICAgIC8vIEFkZCBzdHlsZSBlbnRyeSBwb2ludHMuXG4gICAgICBpZiAoZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0pIHtcbiAgICAgICAgZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0ucHVzaChyZXNvbHZlZFBhdGgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0gPSBbcmVzb2x2ZWRQYXRoXTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIGxhenkgc3R5bGVzIHRvIHRoZSBsaXN0LlxuICAgICAgaWYgKHN0eWxlLmxhenkpIHtcbiAgICAgICAgY2h1bmtOYW1lcy5wdXNoKHN0eWxlLmJ1bmRsZU5hbWUpO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgZ2xvYmFsIGNzcyBwYXRocy5cbiAgICAgIGdsb2JhbFN0eWxlUGF0aHMucHVzaChyZXNvbHZlZFBhdGgpO1xuICAgIH0pO1xuXG4gICAgaWYgKGNodW5rTmFtZXMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gQWRkIHBsdWdpbiB0byByZW1vdmUgaGFzaGVzIGZyb20gbGF6eSBzdHlsZXMuXG4gICAgICBleHRyYVBsdWdpbnMucHVzaChuZXcgUmVtb3ZlSGFzaFBsdWdpbih7IGNodW5rTmFtZXMsIGhhc2hGb3JtYXQgfSkpO1xuICAgIH1cbiAgfVxuXG4gIGxldCBkYXJ0U2Fzczoge30gfCB1bmRlZmluZWQ7XG4gIHRyeSB7XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuICAgIGRhcnRTYXNzID0gcmVxdWlyZSgnc2FzcycpO1xuICB9IGNhdGNoIHsgfVxuXG4gIGxldCBmaWJlcjoge30gfCB1bmRlZmluZWQ7XG4gIGlmIChkYXJ0U2Fzcykge1xuICAgIHRyeSB7XG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG4gICAgICBmaWJlciA9IHJlcXVpcmUoJ2ZpYmVycycpO1xuICAgIH0gY2F0Y2ggeyB9XG4gIH1cblxuICAvLyBzZXQgYmFzZSBydWxlcyB0byBkZXJpdmUgZmluYWwgcnVsZXMgZnJvbVxuICBjb25zdCBiYXNlUnVsZXM6IHdlYnBhY2suUnVsZVNldFJ1bGVbXSA9IFtcbiAgICB7IHRlc3Q6IC9cXC5jc3MkLywgdXNlOiBbXSB9LFxuICAgIHtcbiAgICAgIHRlc3Q6IC9cXC5zY3NzJHxcXC5zYXNzJC8sXG4gICAgICB1c2U6IFt7XG4gICAgICAgIGxvYWRlcjogJ3Nhc3MtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIGltcGxlbWVudGF0aW9uOiBkYXJ0U2FzcyxcbiAgICAgICAgICBmaWJlcixcbiAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICAvLyBib290c3RyYXAtc2FzcyByZXF1aXJlcyBhIG1pbmltdW0gcHJlY2lzaW9uIG9mIDhcbiAgICAgICAgICBwcmVjaXNpb246IDgsXG4gICAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICB9LFxuICAgICAgfV0sXG4gICAgfSxcbiAgICB7XG4gICAgICB0ZXN0OiAvXFwubGVzcyQvLFxuICAgICAgdXNlOiBbe1xuICAgICAgICBsb2FkZXI6ICdsZXNzLWxvYWRlcicsXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICBqYXZhc2NyaXB0RW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAuLi5sZXNzUGF0aE9wdGlvbnMsXG4gICAgICAgIH0sXG4gICAgICB9XSxcbiAgICB9LFxuICAgIHtcbiAgICAgIHRlc3Q6IC9cXC5zdHlsJC8sXG4gICAgICB1c2U6IFt7XG4gICAgICAgIGxvYWRlcjogJ3N0eWx1cy1sb2FkZXInLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgcGF0aHM6IGluY2x1ZGVQYXRocyxcbiAgICAgICAgfSxcbiAgICAgIH1dLFxuICAgIH0sXG4gIF07XG5cbiAgLy8gbG9hZCBjb21wb25lbnQgY3NzIGFzIHJhdyBzdHJpbmdzXG4gIGNvbnN0IHJ1bGVzOiB3ZWJwYWNrLlJ1bGVTZXRSdWxlW10gPSBiYXNlUnVsZXMubWFwKCh7IHRlc3QsIHVzZSB9KSA9PiAoe1xuICAgIGV4Y2x1ZGU6IGdsb2JhbFN0eWxlUGF0aHMsXG4gICAgdGVzdCxcbiAgICB1c2U6IFtcbiAgICAgIHsgbG9hZGVyOiAncmF3LWxvYWRlcicgfSxcbiAgICAgIHtcbiAgICAgICAgbG9hZGVyOiAncG9zdGNzcy1sb2FkZXInLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgaWRlbnQ6ICdlbWJlZGRlZCcsXG4gICAgICAgICAgcGx1Z2luczogcG9zdGNzc1BsdWdpbkNyZWF0b3IsXG4gICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAgPyAnaW5saW5lJyA6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIC4uLih1c2UgYXMgd2VicGFjay5Mb2FkZXJbXSksXG4gICAgXSxcbiAgfSkpO1xuXG4gIC8vIGxvYWQgZ2xvYmFsIGNzcyBhcyBjc3MgZmlsZXNcbiAgaWYgKGdsb2JhbFN0eWxlUGF0aHMubGVuZ3RoID4gMCkge1xuICAgIHJ1bGVzLnB1c2goLi4uYmFzZVJ1bGVzLm1hcCgoeyB0ZXN0LCB1c2UgfSkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaW5jbHVkZTogZ2xvYmFsU3R5bGVQYXRocyxcbiAgICAgICAgdGVzdCxcbiAgICAgICAgdXNlOiBbXG4gICAgICAgICAgYnVpbGRPcHRpb25zLmV4dHJhY3RDc3MgPyBNaW5pQ3NzRXh0cmFjdFBsdWdpbi5sb2FkZXIgOiAnc3R5bGUtbG9hZGVyJyxcbiAgICAgICAgICBSYXdDc3NMb2FkZXIsXG4gICAgICAgICAge1xuICAgICAgICAgICAgbG9hZGVyOiAncG9zdGNzcy1sb2FkZXInLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBpZGVudDogYnVpbGRPcHRpb25zLmV4dHJhY3RDc3MgPyAnZXh0cmFjdGVkJyA6ICdlbWJlZGRlZCcsXG4gICAgICAgICAgICAgIHBsdWdpbnM6IHBvc3Rjc3NQbHVnaW5DcmVhdG9yLFxuICAgICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCAmJiAhYnVpbGRPcHRpb25zLmV4dHJhY3RDc3MgPyAnaW5saW5lJyA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICAuLi4odXNlIGFzIHdlYnBhY2suTG9hZGVyW10pLFxuICAgICAgICBdLFxuICAgICAgfTtcbiAgICB9KSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RDc3MpIHtcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIC8vIGV4dHJhY3QgZ2xvYmFsIGNzcyBmcm9tIGpzIGZpbGVzIGludG8gb3duIGNzcyBmaWxlXG4gICAgICBuZXcgTWluaUNzc0V4dHJhY3RQbHVnaW4oeyBmaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5leHRyYWN0fS5jc3NgIH0pLFxuICAgICAgLy8gc3VwcHJlc3MgZW1wdHkgLmpzIGZpbGVzIGluIGNzcyBvbmx5IGVudHJ5IHBvaW50c1xuICAgICAgbmV3IFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4oKSxcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgbW9kdWxlOiB7IHJ1bGVzIH0sXG4gICAgcGx1Z2luczogZXh0cmFQbHVnaW5zLFxuICB9O1xufVxuIl19