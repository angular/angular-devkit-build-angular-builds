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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOztBQUVILDZCQUE2QjtBQUU3QixtREFLK0I7QUFFL0IsbUNBQXlFO0FBRXpFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUM3QyxNQUFNLG9CQUFvQixHQUFHLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ2hFLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0FBRWpEOzs7Ozs7Ozs7Ozs7R0FZRztBQUVILFNBQWdCLGVBQWUsQ0FBQyxHQUF5QjtJQUN2RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUNuQyxNQUFNLFdBQVcsR0FBZ0MsRUFBRSxDQUFDO0lBQ3BELE1BQU0sZ0JBQWdCLEdBQWEsRUFBRSxDQUFDO0lBQ3RDLE1BQU0sWUFBWSxHQUFHLEVBQUUsQ0FBQztJQUV4QixNQUFNLFlBQVksR0FBRyxZQUFZLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztJQUVuRCw0QkFBNEI7SUFDNUIsTUFBTSxVQUFVLEdBQUcsMkJBQW1CLENBQUMsWUFBWSxDQUFDLGFBQXVCLENBQUMsQ0FBQztJQUU3RSxNQUFNLG9CQUFvQixHQUFHLFVBQVUsTUFBb0M7UUFDekUsT0FBTztZQUNMLGNBQWMsQ0FBQztnQkFDYixPQUFPLEVBQUUsQ0FBQyxHQUFXLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUc7Z0JBQ25F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Z0NBQ2pDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFlBQVk7eUJBQzVCO3FCQUNGO29CQUNELEdBQUksR0FBd0I7aUJBQzdCO2FBQ0YsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDTDtJQUVELElBQUksWUFBWSxDQUFDLFVBQVUsRUFBRTtRQUMzQixZQUFZLENBQUMsSUFBSTtRQUNmLHFEQUFxRDtRQUNyRCxJQUFJLG9CQUFvQixDQUFDLEVBQUUsUUFBUSxFQUFFLFNBQVMsVUFBVSxDQUFDLE9BQU8sTUFBTSxFQUFFLENBQUM7UUFDekUsb0RBQW9EO1FBQ3BELElBQUksa0RBQXdDLEVBQUUsQ0FDL0MsQ0FBQztLQUNIO0lBRUQsT0FBTztRQUNMLEtBQUssRUFBRSxXQUFXO1FBQ2xCLE1BQU0sRUFBRSxFQUFFLEtBQUssRUFBRTtRQUNqQixPQUFPLEVBQUUsWUFBWTtLQUN0QixDQUFDO0FBQ0osQ0FBQztBQXJNRCwwQ0FxTUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHtcbiAgUG9zdGNzc0NsaVJlc291cmNlcyxcbiAgUmF3Q3NzTG9hZGVyLFxuICBSZW1vdmVIYXNoUGx1Z2luLFxuICBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luLFxufSBmcm9tICcuLi8uLi9wbHVnaW5zL3dlYnBhY2snO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGdldE91dHB1dEhhc2hGb3JtYXQsIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMgfSBmcm9tICcuL3V0aWxzJztcblxuY29uc3QgYXV0b3ByZWZpeGVyID0gcmVxdWlyZSgnYXV0b3ByZWZpeGVyJyk7XG5jb25zdCBNaW5pQ3NzRXh0cmFjdFBsdWdpbiA9IHJlcXVpcmUoJ21pbmktY3NzLWV4dHJhY3QtcGx1Z2luJyk7XG5jb25zdCBwb3N0Y3NzSW1wb3J0cyA9IHJlcXVpcmUoJ3Bvc3Rjc3MtaW1wb3J0Jyk7XG5cbi8qKlxuICogRW51bWVyYXRlIGxvYWRlcnMgYW5kIHRoZWlyIGRlcGVuZGVuY2llcyBmcm9tIHRoaXMgZmlsZSB0byBsZXQgdGhlIGRlcGVuZGVuY3kgdmFsaWRhdG9yXG4gKiBrbm93IHRoZXkgYXJlIHVzZWQuXG4gKlxuICogcmVxdWlyZSgnc3R5bGUtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ3Bvc3Rjc3MtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ3N0eWx1cycpXG4gKiByZXF1aXJlKCdzdHlsdXMtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ2xlc3MnKVxuICogcmVxdWlyZSgnbGVzcy1sb2FkZXInKVxuICogcmVxdWlyZSgnbm9kZS1zYXNzJylcbiAqIHJlcXVpcmUoJ3Nhc3MtbG9hZGVyJylcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3R5bGVzQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpIHtcbiAgY29uc3QgeyByb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcbiAgY29uc3QgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nW10gfSA9IHt9O1xuICBjb25zdCBnbG9iYWxTdHlsZVBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBleHRyYVBsdWdpbnMgPSBbXTtcblxuICBjb25zdCBjc3NTb3VyY2VNYXAgPSBidWlsZE9wdGlvbnMuc291cmNlTWFwLnN0eWxlcztcblxuICAvLyBEZXRlcm1pbmUgaGFzaGluZyBmb3JtYXQuXG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nIGFzIHN0cmluZyk7XG5cbiAgY29uc3QgcG9zdGNzc1BsdWdpbkNyZWF0b3IgPSBmdW5jdGlvbiAobG9hZGVyOiB3ZWJwYWNrLmxvYWRlci5Mb2FkZXJDb250ZXh0KSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIHBvc3Rjc3NJbXBvcnRzKHtcbiAgICAgICAgcmVzb2x2ZTogKHVybDogc3RyaW5nKSA9PiB1cmwuc3RhcnRzV2l0aCgnficpID8gdXJsLnN1YnN0cigxKSA6IHVybCxcbiAgICAgICAgbG9hZDogKGZpbGVuYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBsb2FkZXIuZnMucmVhZEZpbGUoZmlsZW5hbWUsIChlcnI6IEVycm9yLCBkYXRhOiBCdWZmZXIpID0+IHtcbiAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShjb250ZW50KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBQb3N0Y3NzQ2xpUmVzb3VyY2VzKHtcbiAgICAgICAgYmFzZUhyZWY6IGJ1aWxkT3B0aW9ucy5iYXNlSHJlZixcbiAgICAgICAgZGVwbG95VXJsOiBidWlsZE9wdGlvbnMuZGVwbG95VXJsLFxuICAgICAgICByZXNvdXJjZXNPdXRwdXRQYXRoOiBidWlsZE9wdGlvbnMucmVzb3VyY2VzT3V0cHV0UGF0aCxcbiAgICAgICAgbG9hZGVyLFxuICAgICAgICByZWJhc2VSb290UmVsYXRpdmU6IGJ1aWxkT3B0aW9ucy5yZWJhc2VSb290UmVsYXRpdmVDc3NVcmxzLFxuICAgICAgICBmaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWAsXG4gICAgICB9KSxcbiAgICAgIGF1dG9wcmVmaXhlcigpLFxuICAgIF07XG4gIH07XG5cbiAgLy8gdXNlIGluY2x1ZGVQYXRocyBmcm9tIGFwcENvbmZpZ1xuICBjb25zdCBpbmNsdWRlUGF0aHM6IHN0cmluZ1tdID0gW107XG4gIGxldCBsZXNzUGF0aE9wdGlvbnM6IHsgcGF0aHM/OiBzdHJpbmdbXSB9ID0ge307XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnNcbiAgICAmJiBidWlsZE9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLmluY2x1ZGVQYXRoc1xuICAgICYmIGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMuaW5jbHVkZVBhdGhzLmxlbmd0aCA+IDBcbiAgKSB7XG4gICAgYnVpbGRPcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucy5pbmNsdWRlUGF0aHMuZm9yRWFjaCgoaW5jbHVkZVBhdGg6IHN0cmluZykgPT5cbiAgICAgIGluY2x1ZGVQYXRocy5wdXNoKHBhdGgucmVzb2x2ZShyb290LCBpbmNsdWRlUGF0aCkpKTtcbiAgICBsZXNzUGF0aE9wdGlvbnMgPSB7XG4gICAgICBwYXRoczogaW5jbHVkZVBhdGhzLFxuICAgIH07XG4gIH1cblxuICAvLyBQcm9jZXNzIGdsb2JhbCBzdHlsZXMuXG4gIGlmIChidWlsZE9wdGlvbnMuc3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBjaHVua05hbWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgbm9ybWFsaXplRXh0cmFFbnRyeVBvaW50cyhidWlsZE9wdGlvbnMuc3R5bGVzLCAnc3R5bGVzJykuZm9yRWFjaChzdHlsZSA9PiB7XG4gICAgICBjb25zdCByZXNvbHZlZFBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgc3R5bGUuaW5wdXQpO1xuICAgICAgLy8gQWRkIHN0eWxlIGVudHJ5IHBvaW50cy5cbiAgICAgIGlmIChlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXSkge1xuICAgICAgICBlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXS5wdXNoKHJlc29sdmVkUGF0aCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXSA9IFtyZXNvbHZlZFBhdGhdO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgbGF6eSBzdHlsZXMgdG8gdGhlIGxpc3QuXG4gICAgICBpZiAoc3R5bGUubGF6eSkge1xuICAgICAgICBjaHVua05hbWVzLnB1c2goc3R5bGUuYnVuZGxlTmFtZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCBnbG9iYWwgY3NzIHBhdGhzLlxuICAgICAgZ2xvYmFsU3R5bGVQYXRocy5wdXNoKHJlc29sdmVkUGF0aCk7XG4gICAgfSk7XG5cbiAgICBpZiAoY2h1bmtOYW1lcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBBZGQgcGx1Z2luIHRvIHJlbW92ZSBoYXNoZXMgZnJvbSBsYXp5IHN0eWxlcy5cbiAgICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBSZW1vdmVIYXNoUGx1Z2luKHsgY2h1bmtOYW1lcywgaGFzaEZvcm1hdCB9KSk7XG4gICAgfVxuICB9XG5cbiAgbGV0IGRhcnRTYXNzOiB7fSB8IHVuZGVmaW5lZDtcbiAgdHJ5IHtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG4gICAgZGFydFNhc3MgPSByZXF1aXJlKCdzYXNzJyk7XG4gIH0gY2F0Y2ggeyB9XG5cbiAgbGV0IGZpYmVyOiB7fSB8IHVuZGVmaW5lZDtcbiAgaWYgKGRhcnRTYXNzKSB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1pbXBsaWNpdC1kZXBlbmRlbmNpZXNcbiAgICAgIGZpYmVyID0gcmVxdWlyZSgnZmliZXJzJyk7XG4gICAgfSBjYXRjaCB7IH1cbiAgfVxuXG4gIC8vIHNldCBiYXNlIHJ1bGVzIHRvIGRlcml2ZSBmaW5hbCBydWxlcyBmcm9tXG4gIGNvbnN0IGJhc2VSdWxlczogd2VicGFjay5SdWxlU2V0UnVsZVtdID0gW1xuICAgIHsgdGVzdDogL1xcLmNzcyQvLCB1c2U6IFtdIH0sXG4gICAge1xuICAgICAgdGVzdDogL1xcLnNjc3MkfFxcLnNhc3MkLyxcbiAgICAgIHVzZTogW3tcbiAgICAgICAgbG9hZGVyOiAnc2Fzcy1sb2FkZXInLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgaW1wbGVtZW50YXRpb246IGRhcnRTYXNzLFxuICAgICAgICAgIGZpYmVyLFxuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIC8vIGJvb3RzdHJhcC1zYXNzIHJlcXVpcmVzIGEgbWluaW11bSBwcmVjaXNpb24gb2YgOFxuICAgICAgICAgIHByZWNpc2lvbjogOCxcbiAgICAgICAgICBpbmNsdWRlUGF0aHMsXG4gICAgICAgIH0sXG4gICAgICB9XSxcbiAgICB9LFxuICAgIHtcbiAgICAgIHRlc3Q6IC9cXC5sZXNzJC8sXG4gICAgICB1c2U6IFt7XG4gICAgICAgIGxvYWRlcjogJ2xlc3MtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIGphdmFzY3JpcHRFbmFibGVkOiB0cnVlLFxuICAgICAgICAgIC4uLmxlc3NQYXRoT3B0aW9ucyxcbiAgICAgICAgfSxcbiAgICAgIH1dLFxuICAgIH0sXG4gICAge1xuICAgICAgdGVzdDogL1xcLnN0eWwkLyxcbiAgICAgIHVzZTogW3tcbiAgICAgICAgbG9hZGVyOiAnc3R5bHVzLWxvYWRlcicsXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICBwYXRoczogaW5jbHVkZVBhdGhzLFxuICAgICAgICB9LFxuICAgICAgfV0sXG4gICAgfSxcbiAgXTtcblxuICAvLyBsb2FkIGNvbXBvbmVudCBjc3MgYXMgcmF3IHN0cmluZ3NcbiAgY29uc3QgcnVsZXM6IHdlYnBhY2suUnVsZVNldFJ1bGVbXSA9IGJhc2VSdWxlcy5tYXAoKHsgdGVzdCwgdXNlIH0pID0+ICh7XG4gICAgZXhjbHVkZTogZ2xvYmFsU3R5bGVQYXRocyxcbiAgICB0ZXN0LFxuICAgIHVzZTogW1xuICAgICAgeyBsb2FkZXI6ICdyYXctbG9hZGVyJyB9LFxuICAgICAge1xuICAgICAgICBsb2FkZXI6ICdwb3N0Y3NzLWxvYWRlcicsXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBpZGVudDogJ2VtYmVkZGVkJyxcbiAgICAgICAgICBwbHVnaW5zOiBwb3N0Y3NzUGx1Z2luQ3JlYXRvcixcbiAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCAmJiAhYnVpbGRPcHRpb25zLnNvdXJjZU1hcC5oaWRkZW4gPyAnaW5saW5lJyA6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIC4uLih1c2UgYXMgd2VicGFjay5Mb2FkZXJbXSksXG4gICAgXSxcbiAgfSkpO1xuXG4gIC8vIGxvYWQgZ2xvYmFsIGNzcyBhcyBjc3MgZmlsZXNcbiAgaWYgKGdsb2JhbFN0eWxlUGF0aHMubGVuZ3RoID4gMCkge1xuICAgIHJ1bGVzLnB1c2goLi4uYmFzZVJ1bGVzLm1hcCgoeyB0ZXN0LCB1c2UgfSkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaW5jbHVkZTogZ2xvYmFsU3R5bGVQYXRocyxcbiAgICAgICAgdGVzdCxcbiAgICAgICAgdXNlOiBbXG4gICAgICAgICAgYnVpbGRPcHRpb25zLmV4dHJhY3RDc3MgPyBNaW5pQ3NzRXh0cmFjdFBsdWdpbi5sb2FkZXIgOiAnc3R5bGUtbG9hZGVyJyxcbiAgICAgICAgICBSYXdDc3NMb2FkZXIsXG4gICAgICAgICAge1xuICAgICAgICAgICAgbG9hZGVyOiAncG9zdGNzcy1sb2FkZXInLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBpZGVudDogYnVpbGRPcHRpb25zLmV4dHJhY3RDc3MgPyAnZXh0cmFjdGVkJyA6ICdlbWJlZGRlZCcsXG4gICAgICAgICAgICAgIHBsdWdpbnM6IHBvc3Rjc3NQbHVnaW5DcmVhdG9yLFxuICAgICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcFxuICAgICAgICAgICAgICAgICYmICFidWlsZE9wdGlvbnMuZXh0cmFjdENzc1xuICAgICAgICAgICAgICAgICYmICFidWlsZE9wdGlvbnMuc291cmNlTWFwLmhpZGRlblxuICAgICAgICAgICAgICAgID8gJ2lubGluZScgOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgLi4uKHVzZSBhcyB3ZWJwYWNrLkxvYWRlcltdKSxcbiAgICAgICAgXSxcbiAgICAgIH07XG4gICAgfSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5leHRyYWN0Q3NzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICAvLyBleHRyYWN0IGdsb2JhbCBjc3MgZnJvbSBqcyBmaWxlcyBpbnRvIG93biBjc3MgZmlsZVxuICAgICAgbmV3IE1pbmlDc3NFeHRyYWN0UGx1Z2luKHsgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuZXh0cmFjdH0uY3NzYCB9KSxcbiAgICAgIC8vIHN1cHByZXNzIGVtcHR5IC5qcyBmaWxlcyBpbiBjc3Mgb25seSBlbnRyeSBwb2ludHNcbiAgICAgIG5ldyBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luKCksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZW50cnk6IGVudHJ5UG9pbnRzLFxuICAgIG1vZHVsZTogeyBydWxlcyB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2lucyxcbiAgfTtcbn1cbiJdfQ==