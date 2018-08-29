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
const webpack_1 = require("../../plugins/webpack");
const utils_1 = require("./utils");
const find_up_1 = require("../../utilities/find-up");
const webpack_2 = require("../../plugins/webpack");
const utils_2 = require("./utils");
const remove_hash_plugin_1 = require("../../plugins/remove-hash-plugin");
const postcssUrl = require('postcss-url');
const autoprefixer = require('autoprefixer');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const postcssImports = require('postcss-import');
const PostcssCliResources = require('../../plugins/webpack').PostcssCliResources;
function getStylesConfig(wco) {
    const { root, projectRoot, buildOptions } = wco;
    // const appRoot = path.resolve(projectRoot, appConfig.root);
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
                resolve: (url, context) => {
                    return new Promise((resolve, reject) => {
                        let hadTilde = false;
                        if (url && url.startsWith('~')) {
                            url = url.substr(1);
                            hadTilde = true;
                        }
                        loader.resolve(context, (hadTilde ? '' : './') + url, (err, result) => {
                            if (err) {
                                if (hadTilde) {
                                    reject(err);
                                    return;
                                }
                                loader.resolve(context, url, (err, result) => {
                                    if (err) {
                                        reject(err);
                                    }
                                    else {
                                        resolve(result);
                                    }
                                });
                            }
                            else {
                                resolve(result);
                            }
                        });
                    });
                },
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
                }
            }),
            postcssUrl({
                filter: ({ url }) => url.startsWith('~'),
                url: ({ url }) => {
                    // Note: This will only find the first node_modules folder.
                    const nodeModules = find_up_1.findUp('node_modules', projectRoot);
                    if (!nodeModules) {
                        throw new Error('Cannot locate node_modules directory.');
                    }
                    const fullPath = path.join(nodeModules, url.substr(1));
                    return path.relative(loader.context, fullPath).replace(/\\/g, '/');
                }
            }),
            postcssUrl([
                {
                    // Only convert root relative URLs, which CSS-Loader won't process into require().
                    filter: ({ url }) => url.startsWith('/') && !url.startsWith('//'),
                    url: ({ url }) => {
                        if (deployUrl.match(/:\/\//) || deployUrl.startsWith('/')) {
                            // If deployUrl is absolute or root relative, ignore baseHref & use deployUrl as is.
                            return `${deployUrl.replace(/\/$/, '')}${url}`;
                        }
                        else if (baseHref.match(/:\/\//)) {
                            // If baseHref contains a scheme, include it as is.
                            return baseHref.replace(/\/$/, '') +
                                `/${deployUrl}/${url}`.replace(/\/\/+/g, '/');
                        }
                        else {
                            // Join together base-href, deploy-url and the original URL.
                            // Also dedupe multiple slashes into single ones.
                            return `/${baseHref}/${deployUrl}/${url}`.replace(/\/\/+/g, '/');
                        }
                    }
                }
            ]),
            PostcssCliResources({
                deployUrl: loader.loaders[loader.loaderIndex].options.ident == 'extracted' ? '' : deployUrl,
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
        utils_2.normalizeExtraEntryPoints(buildOptions.styles, 'styles').forEach(style => {
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
            extraPlugins.push(new remove_hash_plugin_1.RemoveHashPlugin({ chunkNames, hashFormat }));
        }
    }
    let dartSass;
    try {
        dartSass = require('sass');
    }
    catch (_a) { }
    let fiber;
    if (dartSass) {
        try {
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
                        includePaths
                    }
                }]
        },
        {
            test: /\.less$/,
            use: [{
                    loader: 'less-loader',
                    options: Object.assign({ sourceMap: cssSourceMap, javascriptEnabled: true }, lessPathOptions)
                }]
        },
        {
            test: /\.styl$/,
            use: [{
                    loader: 'stylus-loader',
                    options: {
                        sourceMap: cssSourceMap,
                        paths: includePaths
                    }
                }]
        }
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
                    sourceMap: cssSourceMap ? 'inline' : false
                }
            },
            ...use
        ]
    }));
    // load global css as css files
    if (globalStylePaths.length > 0) {
        rules.push(...baseRules.map(({ test, use }) => {
            const extractTextPlugin = {
                use: [
                    // style-loader still has issues with relative url()'s with sourcemaps enabled;
                    // even with the convertToAbsoluteUrls options as it uses 'document.location'
                    // which breaks when used with routing.
                    // Once style-loader 1.0 is released the following conditional won't be necessary
                    // due to this 1.0 PR: https://github.com/webpack-contrib/style-loader/pull/219
                    { loader: buildOptions.extractCss ? webpack_2.RawCssLoader : 'raw-loader' },
                    {
                        loader: 'postcss-loader',
                        options: {
                            ident: buildOptions.extractCss ? 'extracted' : 'embedded',
                            plugins: postcssPluginCreator,
                            sourceMap: cssSourceMap && !buildOptions.extractCss ? 'inline' : cssSourceMap
                        }
                    },
                    ...use
                ],
                // publicPath needed as a workaround https://github.com/angular/angular-cli/issues/4035
                publicPath: ''
            };
            const ret = {
                include: globalStylePaths,
                test,
                use: [
                    buildOptions.extractCss ? MiniCssExtractPlugin.loader : 'style-loader',
                    ...extractTextPlugin.use,
                ]
            };
            // Save the original options as arguments for eject.
            // if (buildOptions.extractCss) {
            //   ret[pluginArgs] = extractTextPlugin;
            // }
            return ret;
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
        plugins: extraPlugins
    };
}
exports.getStylesConfig = getStylesConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HO0FBQ0gsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFHL0QsNkJBQTZCO0FBQzdCLG1EQUFpRjtBQUNqRixtQ0FBOEM7QUFFOUMscURBQWlEO0FBQ2pELG1EQUFxRDtBQUNyRCxtQ0FBb0Q7QUFDcEQseUVBQW9FO0FBRXBFLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUMxQyxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDN0MsTUFBTSxvQkFBb0IsR0FBRyxPQUFPLENBQUMseUJBQXlCLENBQUMsQ0FBQztBQUNoRSxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztBQUNqRCxNQUFNLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLG1CQUFtQixDQUFDO0FBc0JqRix5QkFBZ0MsR0FBeUI7SUFDdkQsTUFBTSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBRWhELDZEQUE2RDtJQUM3RCxNQUFNLFdBQVcsR0FBZ0MsRUFBRSxDQUFDO0lBQ3BELE1BQU0sZ0JBQWdCLEdBQWEsRUFBRSxDQUFDO0lBQ3RDLE1BQU0sWUFBWSxHQUFVLEVBQUUsQ0FBQztJQUMvQixNQUFNLFlBQVksR0FBRyxZQUFZLENBQUMsU0FBUyxDQUFDO0lBRTVDLDRCQUE0QjtJQUM1QixNQUFNLFVBQVUsR0FBRywyQkFBbUIsQ0FBQyxZQUFZLENBQUMsYUFBdUIsQ0FBQyxDQUFDO0lBQzdFLDBFQUEwRTtJQUMxRSxNQUFNLFFBQVEsR0FB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VUFBVSxDQUFDLE9BQU8sTUFBTSxFQUFFLENBQUM7UUFDekUsb0RBQW9EO1FBQ3BELElBQUksa0RBQXdDLEVBQUUsQ0FDL0MsQ0FBQztLQUNIO0lBRUQsT0FBTztRQUNMLEtBQUssRUFBRSxXQUFXO1FBQ2xCLE1BQU0sRUFBRSxFQUFFLEtBQUssRUFBRTtRQUNqQixPQUFPLEVBQUUsWUFBWTtLQUN0QixDQUFDO0FBQ0osQ0FBQztBQTNRRCwwQ0EyUUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG4vLyB0c2xpbnQ6ZGlzYWJsZVxuLy8gVE9ETzogY2xlYW51cCB0aGlzIGZpbGUsIGl0J3MgY29waWVkIGFzIGlzIGZyb20gQW5ndWxhciBDTEkuXG5cbmltcG9ydCAqIGFzIHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgU3VwcHJlc3NFeHRyYWN0ZWRUZXh0Q2h1bmtzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvd2VicGFjayc7XG5pbXBvcnQgeyBnZXRPdXRwdXRIYXNoRm9ybWF0IH0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgZmluZFVwIH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL2ZpbmQtdXAnO1xuaW1wb3J0IHsgUmF3Q3NzTG9hZGVyIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy93ZWJwYWNrJztcbmltcG9ydCB7IG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMgfSBmcm9tICcuL3V0aWxzJztcbmltcG9ydCB7IFJlbW92ZUhhc2hQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL3JlbW92ZS1oYXNoLXBsdWdpbic7XG5cbmNvbnN0IHBvc3Rjc3NVcmwgPSByZXF1aXJlKCdwb3N0Y3NzLXVybCcpO1xuY29uc3QgYXV0b3ByZWZpeGVyID0gcmVxdWlyZSgnYXV0b3ByZWZpeGVyJyk7XG5jb25zdCBNaW5pQ3NzRXh0cmFjdFBsdWdpbiA9IHJlcXVpcmUoJ21pbmktY3NzLWV4dHJhY3QtcGx1Z2luJyk7XG5jb25zdCBwb3N0Y3NzSW1wb3J0cyA9IHJlcXVpcmUoJ3Bvc3Rjc3MtaW1wb3J0Jyk7XG5jb25zdCBQb3N0Y3NzQ2xpUmVzb3VyY2VzID0gcmVxdWlyZSgnLi4vLi4vcGx1Z2lucy93ZWJwYWNrJykuUG9zdGNzc0NsaVJlc291cmNlcztcblxuLyoqXG4gKiBFbnVtZXJhdGUgbG9hZGVycyBhbmQgdGhlaXIgZGVwZW5kZW5jaWVzIGZyb20gdGhpcyBmaWxlIHRvIGxldCB0aGUgZGVwZW5kZW5jeSB2YWxpZGF0b3JcbiAqIGtub3cgdGhleSBhcmUgdXNlZC5cbiAqXG4gKiByZXF1aXJlKCdzdHlsZS1sb2FkZXInKVxuICogcmVxdWlyZSgncG9zdGNzcy1sb2FkZXInKVxuICogcmVxdWlyZSgnc3R5bHVzJylcbiAqIHJlcXVpcmUoJ3N0eWx1cy1sb2FkZXInKVxuICogcmVxdWlyZSgnbGVzcycpXG4gKiByZXF1aXJlKCdsZXNzLWxvYWRlcicpXG4gKiByZXF1aXJlKCdub2RlLXNhc3MnKVxuICogcmVxdWlyZSgnc2Fzcy1sb2FkZXInKVxuICovXG5cbmludGVyZmFjZSBQb3N0Y3NzVXJsQXNzZXQge1xuICB1cmw6IHN0cmluZztcbiAgaGFzaDogc3RyaW5nO1xuICBhYnNvbHV0ZVBhdGg6IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN0eWxlc0NvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKSB7XG4gIGNvbnN0IHsgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkT3B0aW9ucyB9ID0gd2NvO1xuXG4gIC8vIGNvbnN0IGFwcFJvb3QgPSBwYXRoLnJlc29sdmUocHJvamVjdFJvb3QsIGFwcENvbmZpZy5yb290KTtcbiAgY29uc3QgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nW10gfSA9IHt9O1xuICBjb25zdCBnbG9iYWxTdHlsZVBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBleHRyYVBsdWdpbnM6IGFueVtdID0gW107XG4gIGNvbnN0IGNzc1NvdXJjZU1hcCA9IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXA7XG5cbiAgLy8gRGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0LlxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyBhcyBzdHJpbmcpO1xuICAvLyBDb252ZXJ0IGFic29sdXRlIHJlc291cmNlIFVSTHMgdG8gYWNjb3VudCBmb3IgYmFzZS1ocmVmIGFuZCBkZXBsb3ktdXJsLlxuICBjb25zdCBiYXNlSHJlZiA9IHdjby5idWlsZE9wdGlvbnMuYmFzZUhyZWYgfHwgJyc7XG4gIGNvbnN0IGRlcGxveVVybCA9IHdjby5idWlsZE9wdGlvbnMuZGVwbG95VXJsIHx8ICcnO1xuXG4gIGNvbnN0IHBvc3Rjc3NQbHVnaW5DcmVhdG9yID0gZnVuY3Rpb24gKGxvYWRlcjogd2VicGFjay5sb2FkZXIuTG9hZGVyQ29udGV4dCkge1xuICAgIHJldHVybiBbXG4gICAgICBwb3N0Y3NzSW1wb3J0cyh7XG4gICAgICAgIHJlc29sdmU6ICh1cmw6IHN0cmluZywgY29udGV4dDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgbGV0IGhhZFRpbGRlID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAodXJsICYmIHVybC5zdGFydHNXaXRoKCd+JykpIHtcbiAgICAgICAgICAgICAgdXJsID0gdXJsLnN1YnN0cigxKTtcbiAgICAgICAgICAgICAgaGFkVGlsZGUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9hZGVyLnJlc29sdmUoY29udGV4dCwgKGhhZFRpbGRlID8gJycgOiAnLi8nKSArIHVybCwgKGVycjogRXJyb3IsIHJlc3VsdDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoaGFkVGlsZGUpIHtcbiAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsb2FkZXIucmVzb2x2ZShjb250ZXh0LCB1cmwsIChlcnI6IEVycm9yLCByZXN1bHQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBsb2FkOiAoZmlsZW5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGxvYWRlci5mcy5yZWFkRmlsZShmaWxlbmFtZSwgKGVycjogRXJyb3IsIGRhdGE6IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShjb250ZW50KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIHBvc3Rjc3NVcmwoe1xuICAgICAgICBmaWx0ZXI6ICh7IHVybCB9OiBQb3N0Y3NzVXJsQXNzZXQpID0+IHVybC5zdGFydHNXaXRoKCd+JyksXG4gICAgICAgIHVybDogKHsgdXJsIH06IFBvc3Rjc3NVcmxBc3NldCkgPT4ge1xuICAgICAgICAgIC8vIE5vdGU6IFRoaXMgd2lsbCBvbmx5IGZpbmQgdGhlIGZpcnN0IG5vZGVfbW9kdWxlcyBmb2xkZXIuXG4gICAgICAgICAgY29uc3Qgbm9kZU1vZHVsZXMgPSBmaW5kVXAoJ25vZGVfbW9kdWxlcycsIHByb2plY3RSb290KTtcbiAgICAgICAgICBpZiAoIW5vZGVNb2R1bGVzKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBsb2NhdGUgbm9kZV9tb2R1bGVzIGRpcmVjdG9yeS4nKVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihub2RlTW9kdWxlcywgdXJsLnN1YnN0cigxKSk7XG4gICAgICAgICAgcmV0dXJuIHBhdGgucmVsYXRpdmUobG9hZGVyLmNvbnRleHQsIGZ1bGxQYXRoKS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgcG9zdGNzc1VybChbXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBPbmx5IGNvbnZlcnQgcm9vdCByZWxhdGl2ZSBVUkxzLCB3aGljaCBDU1MtTG9hZGVyIHdvbid0IHByb2Nlc3MgaW50byByZXF1aXJlKCkuXG4gICAgICAgICAgZmlsdGVyOiAoeyB1cmwgfTogUG9zdGNzc1VybEFzc2V0KSA9PiB1cmwuc3RhcnRzV2l0aCgnLycpICYmICF1cmwuc3RhcnRzV2l0aCgnLy8nKSxcbiAgICAgICAgICB1cmw6ICh7IHVybCB9OiBQb3N0Y3NzVXJsQXNzZXQpID0+IHtcbiAgICAgICAgICAgIGlmIChkZXBsb3lVcmwubWF0Y2goLzpcXC9cXC8vKSB8fCBkZXBsb3lVcmwuc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgICAgICAgICAgIC8vIElmIGRlcGxveVVybCBpcyBhYnNvbHV0ZSBvciByb290IHJlbGF0aXZlLCBpZ25vcmUgYmFzZUhyZWYgJiB1c2UgZGVwbG95VXJsIGFzIGlzLlxuICAgICAgICAgICAgICByZXR1cm4gYCR7ZGVwbG95VXJsLnJlcGxhY2UoL1xcLyQvLCAnJyl9JHt1cmx9YDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYmFzZUhyZWYubWF0Y2goLzpcXC9cXC8vKSkge1xuICAgICAgICAgICAgICAvLyBJZiBiYXNlSHJlZiBjb250YWlucyBhIHNjaGVtZSwgaW5jbHVkZSBpdCBhcyBpcy5cbiAgICAgICAgICAgICAgcmV0dXJuIGJhc2VIcmVmLnJlcGxhY2UoL1xcLyQvLCAnJykgK1xuICAgICAgICAgICAgICAgIGAvJHtkZXBsb3lVcmx9LyR7dXJsfWAucmVwbGFjZSgvXFwvXFwvKy9nLCAnLycpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gSm9pbiB0b2dldGhlciBiYXNlLWhyZWYsIGRlcGxveS11cmwgYW5kIHRoZSBvcmlnaW5hbCBVUkwuXG4gICAgICAgICAgICAgIC8vIEFsc28gZGVkdXBlIG11bHRpcGxlIHNsYXNoZXMgaW50byBzaW5nbGUgb25lcy5cbiAgICAgICAgICAgICAgcmV0dXJuIGAvJHtiYXNlSHJlZn0vJHtkZXBsb3lVcmx9LyR7dXJsfWAucmVwbGFjZSgvXFwvXFwvKy9nLCAnLycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgXSksXG4gICAgICBQb3N0Y3NzQ2xpUmVzb3VyY2VzKHtcbiAgICAgICAgZGVwbG95VXJsOiBsb2FkZXIubG9hZGVyc1tsb2FkZXIubG9hZGVySW5kZXhdLm9wdGlvbnMuaWRlbnQgPT0gJ2V4dHJhY3RlZCcgPyAnJyA6IGRlcGxveVVybCxcbiAgICAgICAgbG9hZGVyLFxuICAgICAgICBmaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWAsXG4gICAgICB9KSxcbiAgICAgIGF1dG9wcmVmaXhlcih7IGdyaWQ6IHRydWUgfSksXG4gICAgXTtcbiAgfTtcblxuICAvLyB1c2UgaW5jbHVkZVBhdGhzIGZyb20gYXBwQ29uZmlnXG4gIGNvbnN0IGluY2x1ZGVQYXRoczogc3RyaW5nW10gPSBbXTtcbiAgbGV0IGxlc3NQYXRoT3B0aW9uczogeyBwYXRocz86IHN0cmluZ1tdIH0gPSB7fTtcblxuICBpZiAoYnVpbGRPcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9uc1xuICAgICYmIGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMuaW5jbHVkZVBhdGhzXG4gICAgJiYgYnVpbGRPcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucy5pbmNsdWRlUGF0aHMubGVuZ3RoID4gMFxuICApIHtcbiAgICBidWlsZE9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLmluY2x1ZGVQYXRocy5mb3JFYWNoKChpbmNsdWRlUGF0aDogc3RyaW5nKSA9PlxuICAgICAgaW5jbHVkZVBhdGhzLnB1c2gocGF0aC5yZXNvbHZlKHJvb3QsIGluY2x1ZGVQYXRoKSkpO1xuICAgIGxlc3NQYXRoT3B0aW9ucyA9IHtcbiAgICAgIHBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgfTtcbiAgfVxuXG4gIC8vIFByb2Nlc3MgZ2xvYmFsIHN0eWxlcy5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdHlsZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGNodW5rTmFtZXM6IHN0cmluZ1tdID0gW107XG5cbiAgICBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzKGJ1aWxkT3B0aW9ucy5zdHlsZXMsICdzdHlsZXMnKS5mb3JFYWNoKHN0eWxlID0+IHtcbiAgICAgIGNvbnN0IHJlc29sdmVkUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBzdHlsZS5pbnB1dCk7XG5cbiAgICAgIC8vIEFkZCBzdHlsZSBlbnRyeSBwb2ludHMuXG4gICAgICBpZiAoZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0pIHtcbiAgICAgICAgZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0ucHVzaChyZXNvbHZlZFBhdGgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXSA9IFtyZXNvbHZlZFBhdGhdXG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCBsYXp5IHN0eWxlcyB0byB0aGUgbGlzdC5cbiAgICAgIGlmIChzdHlsZS5sYXp5KSB7XG4gICAgICAgIGNodW5rTmFtZXMucHVzaChzdHlsZS5idW5kbGVOYW1lKTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIGdsb2JhbCBjc3MgcGF0aHMuXG4gICAgICBnbG9iYWxTdHlsZVBhdGhzLnB1c2gocmVzb2x2ZWRQYXRoKTtcbiAgICB9KTtcblxuICAgIGlmIChjaHVua05hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIEFkZCBwbHVnaW4gdG8gcmVtb3ZlIGhhc2hlcyBmcm9tIGxhenkgc3R5bGVzLlxuICAgICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFJlbW92ZUhhc2hQbHVnaW4oeyBjaHVua05hbWVzLCBoYXNoRm9ybWF0IH0pKTtcbiAgICB9XG4gIH1cblxuICBsZXQgZGFydFNhc3M6IHt9IHwgdW5kZWZpbmVkO1xuICB0cnkge1xuICAgIGRhcnRTYXNzID0gcmVxdWlyZSgnc2FzcycpO1xuICB9IGNhdGNoIHsgfVxuXG4gIGxldCBmaWJlcjoge30gfCB1bmRlZmluZWQ7XG4gIGlmIChkYXJ0U2Fzcykge1xuICAgIHRyeSB7XG4gICAgICBmaWJlciA9IHJlcXVpcmUoJ2ZpYmVycycpO1xuICAgIH0gY2F0Y2ggeyB9XG4gIH1cblxuICAvLyBzZXQgYmFzZSBydWxlcyB0byBkZXJpdmUgZmluYWwgcnVsZXMgZnJvbVxuICBjb25zdCBiYXNlUnVsZXM6IHdlYnBhY2suUnVsZVtdID0gW1xuICAgIHsgdGVzdDogL1xcLmNzcyQvLCB1c2U6IFtdIH0sXG4gICAge1xuICAgICAgdGVzdDogL1xcLnNjc3MkfFxcLnNhc3MkLyxcbiAgICAgIHVzZTogW3tcbiAgICAgICAgbG9hZGVyOiAnc2Fzcy1sb2FkZXInLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgaW1wbGVtZW50YXRpb246IGRhcnRTYXNzLFxuICAgICAgICAgIGZpYmVyLFxuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIC8vIGJvb3RzdHJhcC1zYXNzIHJlcXVpcmVzIGEgbWluaW11bSBwcmVjaXNpb24gb2YgOFxuICAgICAgICAgIHByZWNpc2lvbjogOCxcbiAgICAgICAgICBpbmNsdWRlUGF0aHNcbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9LFxuICAgIHtcbiAgICAgIHRlc3Q6IC9cXC5sZXNzJC8sXG4gICAgICB1c2U6IFt7XG4gICAgICAgIGxvYWRlcjogJ2xlc3MtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIGphdmFzY3JpcHRFbmFibGVkOiB0cnVlLFxuICAgICAgICAgIC4uLmxlc3NQYXRoT3B0aW9ucyxcbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9LFxuICAgIHtcbiAgICAgIHRlc3Q6IC9cXC5zdHlsJC8sXG4gICAgICB1c2U6IFt7XG4gICAgICAgIGxvYWRlcjogJ3N0eWx1cy1sb2FkZXInLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgcGF0aHM6IGluY2x1ZGVQYXRoc1xuICAgICAgICB9XG4gICAgICB9XVxuICAgIH1cbiAgXTtcblxuICAvLyBsb2FkIGNvbXBvbmVudCBjc3MgYXMgcmF3IHN0cmluZ3NcbiAgY29uc3QgcnVsZXM6IHdlYnBhY2suUnVsZVtdID0gYmFzZVJ1bGVzLm1hcCgoeyB0ZXN0LCB1c2UgfSkgPT4gKHtcbiAgICBleGNsdWRlOiBnbG9iYWxTdHlsZVBhdGhzLFxuICAgIHRlc3QsXG4gICAgdXNlOiBbXG4gICAgICB7IGxvYWRlcjogJ3Jhdy1sb2FkZXInIH0sXG4gICAgICB7XG4gICAgICAgIGxvYWRlcjogJ3Bvc3Rjc3MtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIGlkZW50OiAnZW1iZWRkZWQnLFxuICAgICAgICAgIHBsdWdpbnM6IHBvc3Rjc3NQbHVnaW5DcmVhdG9yLFxuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwID8gJ2lubGluZScgOiBmYWxzZVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgLi4uKHVzZSBhcyB3ZWJwYWNrLkxvYWRlcltdKVxuICAgIF1cbiAgfSkpO1xuXG4gIC8vIGxvYWQgZ2xvYmFsIGNzcyBhcyBjc3MgZmlsZXNcbiAgaWYgKGdsb2JhbFN0eWxlUGF0aHMubGVuZ3RoID4gMCkge1xuICAgIHJ1bGVzLnB1c2goLi4uYmFzZVJ1bGVzLm1hcCgoeyB0ZXN0LCB1c2UgfSkgPT4ge1xuICAgICAgY29uc3QgZXh0cmFjdFRleHRQbHVnaW4gPSB7XG4gICAgICAgIHVzZTogW1xuICAgICAgICAgIC8vIHN0eWxlLWxvYWRlciBzdGlsbCBoYXMgaXNzdWVzIHdpdGggcmVsYXRpdmUgdXJsKCkncyB3aXRoIHNvdXJjZW1hcHMgZW5hYmxlZDtcbiAgICAgICAgICAvLyBldmVuIHdpdGggdGhlIGNvbnZlcnRUb0Fic29sdXRlVXJscyBvcHRpb25zIGFzIGl0IHVzZXMgJ2RvY3VtZW50LmxvY2F0aW9uJ1xuICAgICAgICAgIC8vIHdoaWNoIGJyZWFrcyB3aGVuIHVzZWQgd2l0aCByb3V0aW5nLlxuICAgICAgICAgIC8vIE9uY2Ugc3R5bGUtbG9hZGVyIDEuMCBpcyByZWxlYXNlZCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbmFsIHdvbid0IGJlIG5lY2Vzc2FyeVxuICAgICAgICAgIC8vIGR1ZSB0byB0aGlzIDEuMCBQUjogaHR0cHM6Ly9naXRodWIuY29tL3dlYnBhY2stY29udHJpYi9zdHlsZS1sb2FkZXIvcHVsbC8yMTlcbiAgICAgICAgICB7IGxvYWRlcjogYnVpbGRPcHRpb25zLmV4dHJhY3RDc3MgPyBSYXdDc3NMb2FkZXIgOiAncmF3LWxvYWRlcicgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBsb2FkZXI6ICdwb3N0Y3NzLWxvYWRlcicsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGlkZW50OiBidWlsZE9wdGlvbnMuZXh0cmFjdENzcyA/ICdleHRyYWN0ZWQnIDogJ2VtYmVkZGVkJyxcbiAgICAgICAgICAgICAgcGx1Z2luczogcG9zdGNzc1BsdWdpbkNyZWF0b3IsXG4gICAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwICYmICFidWlsZE9wdGlvbnMuZXh0cmFjdENzcyA/ICdpbmxpbmUnIDogY3NzU291cmNlTWFwXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICAuLi4odXNlIGFzIHdlYnBhY2suTG9hZGVyW10pXG4gICAgICAgIF0sXG4gICAgICAgIC8vIHB1YmxpY1BhdGggbmVlZGVkIGFzIGEgd29ya2Fyb3VuZCBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvNDAzNVxuICAgICAgICBwdWJsaWNQYXRoOiAnJ1xuICAgICAgfTtcbiAgICAgIGNvbnN0IHJldDogYW55ID0ge1xuICAgICAgICBpbmNsdWRlOiBnbG9iYWxTdHlsZVBhdGhzLFxuICAgICAgICB0ZXN0LFxuICAgICAgICB1c2U6IFtcbiAgICAgICAgICBidWlsZE9wdGlvbnMuZXh0cmFjdENzcyA/IE1pbmlDc3NFeHRyYWN0UGx1Z2luLmxvYWRlciA6ICdzdHlsZS1sb2FkZXInLFxuICAgICAgICAgIC4uLmV4dHJhY3RUZXh0UGx1Z2luLnVzZSxcbiAgICAgICAgXVxuICAgICAgfTtcbiAgICAgIC8vIFNhdmUgdGhlIG9yaWdpbmFsIG9wdGlvbnMgYXMgYXJndW1lbnRzIGZvciBlamVjdC5cbiAgICAgIC8vIGlmIChidWlsZE9wdGlvbnMuZXh0cmFjdENzcykge1xuICAgICAgLy8gICByZXRbcGx1Z2luQXJnc10gPSBleHRyYWN0VGV4dFBsdWdpbjtcbiAgICAgIC8vIH1cbiAgICAgIHJldHVybiByZXQ7XG4gICAgfSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5leHRyYWN0Q3NzKSB7XG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICAvLyBleHRyYWN0IGdsb2JhbCBjc3MgZnJvbSBqcyBmaWxlcyBpbnRvIG93biBjc3MgZmlsZVxuICAgICAgbmV3IE1pbmlDc3NFeHRyYWN0UGx1Z2luKHsgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuZXh0cmFjdH0uY3NzYCB9KSxcbiAgICAgIC8vIHN1cHByZXNzIGVtcHR5IC5qcyBmaWxlcyBpbiBjc3Mgb25seSBlbnRyeSBwb2ludHNcbiAgICAgIG5ldyBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luKCksXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZW50cnk6IGVudHJ5UG9pbnRzLFxuICAgIG1vZHVsZTogeyBydWxlcyB9LFxuICAgIHBsdWdpbnM6IGV4dHJhUGx1Z2luc1xuICB9O1xufVxuIl19