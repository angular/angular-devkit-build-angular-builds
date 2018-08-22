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
    // Maximum resource size to inline (KiB)
    const maximumInlineSize = 10;
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
                },
                {
                    // TODO: inline .cur if not supporting IE (use browserslist to check)
                    filter: (asset) => {
                        return maximumInlineSize > 0 && !asset.hash && !asset.absolutePath.endsWith('.cur');
                    },
                    url: 'inline',
                    // NOTE: maxSize is in KB
                    maxSize: maximumInlineSize,
                    fallback: 'rebase',
                },
                { url: 'rebase' },
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
        const chunkIds = [];
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
                chunkIds.push(style.bundleName);
            }
            // Add global css paths.
            globalStylePaths.push(resolvedPath);
        });
        if (chunkIds.length > 0) {
            // Add plugin to remove hashes from lazy styles.
            extraPlugins.push(new remove_hash_plugin_1.RemoveHashPlugin({ chunkIds, hashFormat }));
        }
    }
    // set base rules to derive final rules from
    const baseRules = [
        { test: /\.css$/, use: [] },
        {
            test: /\.scss$|\.sass$/, use: [{
                    loader: 'sass-loader',
                    options: {
                        sourceMap: cssSourceMap,
                        // bootstrap-sass requires a minimum precision of 8
                        precision: 8,
                        includePaths
                    }
                }]
        },
        {
            test: /\.less$/, use: [{
                    loader: 'less-loader',
                    options: Object.assign({ sourceMap: cssSourceMap, javascriptEnabled: true }, lessPathOptions)
                }]
        },
        {
            test: /\.styl$/, use: [{
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
        exclude: globalStylePaths, test, use: [
            { loader: 'raw-loader' },
            {
                loader: 'postcss-loader',
                options: {
                    ident: 'embedded',
                    plugins: postcssPluginCreator,
                    sourceMap: cssSourceMap
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
                            sourceMap: cssSourceMap
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
        // extract global css from js files into own css file
        extraPlugins.push(new MiniCssExtractPlugin({ filename: `[name]${hashFormat.extract}.css` }));
        // suppress empty .js files in css only entry points
        extraPlugins.push(new webpack_1.SuppressExtractedTextChunksWebpackPlugin());
    }
    return {
        entry: entryPoints,
        module: { rules },
        plugins: [].concat(extraPlugins)
    };
}
exports.getStylesConfig = getStylesConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HO0FBQ0gsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFHL0QsNkJBQTZCO0FBQzdCLG1EQUFpRjtBQUNqRixtQ0FBOEM7QUFFOUMscURBQWlEO0FBQ2pELG1EQUFxRDtBQUVyRCxtQ0FBb0Q7QUFDcEQseUVBQW9FO0FBRXBFLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUMxQyxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDN0MsTUFBTSxvQkFBb0IsR0FBRyxPQUFPLENBQUMseUJBQXlCLENBQUMsQ0FBQztBQUNoRSxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztBQUNqRCxNQUFNLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLG1CQUFtQixDQUFDO0FBc0JqRix5QkFBZ0MsR0FBeUI7SUFDdkQsTUFBTSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBRWhELDZEQUE2RDtJQUM3RCxNQUFNLFdBQVcsR0FBZ0MsRUFBRSxDQUFDO0lBQ3BELE1BQU0sZ0JBQWdCLEdBQWEsRUFBRSxDQUFDO0lBQ3RDLE1BQU0sWUFBWSxHQUFVLEVBQUUsQ0FBQztJQUMvQixNQUFNLFlBQVksR0FBRyxZQUFZLENBQUMsU0FBUyxDQUFDO0lBRTVDLHdDQUF3QztJQUN4QyxNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztJQUM3Qiw0QkFBNEI7SUFDNUIsTUFBTSxVQUFVLEdBQUcsMkJBQW1CLENBQUMsWUFBWSxDQUFDLGFB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LENBQUMsT0FBTyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDN0Usb0RBQW9EO1FBQ3BELFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxrREFBd0MsRUFBRSxDQUFDLENBQUM7S0FDbkU7SUFFRCxPQUFPO1FBQ0wsS0FBSyxFQUFFLFdBQVc7UUFDbEIsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFO1FBQ2pCLE9BQU8sRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLFlBQW1CLENBQUM7S0FDeEMsQ0FBQztBQUNKLENBQUM7QUFwUUQsMENBb1FDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuLy8gdHNsaW50OmRpc2FibGVcbi8vIFRPRE86IGNsZWFudXAgdGhpcyBmaWxlLCBpdCdzIGNvcGllZCBhcyBpcyBmcm9tIEFuZ3VsYXIgQ0xJLlxuXG5pbXBvcnQgKiBhcyB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4gfSBmcm9tICcuLi8uLi9wbHVnaW5zL3dlYnBhY2snO1xuaW1wb3J0IHsgZ2V0T3V0cHV0SGFzaEZvcm1hdCB9IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9idWlsZC1vcHRpb25zJztcbmltcG9ydCB7IGZpbmRVcCB9IGZyb20gJy4uLy4uL3V0aWxpdGllcy9maW5kLXVwJztcbmltcG9ydCB7IFJhd0Nzc0xvYWRlciB9IGZyb20gJy4uLy4uL3BsdWdpbnMvd2VicGFjayc7XG5pbXBvcnQgeyBFeHRyYUVudHJ5UG9pbnQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3NjaGVtYSc7XG5pbXBvcnQgeyBub3JtYWxpemVFeHRyYUVudHJ5UG9pbnRzIH0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgeyBSZW1vdmVIYXNoUGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy9yZW1vdmUtaGFzaC1wbHVnaW4nO1xuXG5jb25zdCBwb3N0Y3NzVXJsID0gcmVxdWlyZSgncG9zdGNzcy11cmwnKTtcbmNvbnN0IGF1dG9wcmVmaXhlciA9IHJlcXVpcmUoJ2F1dG9wcmVmaXhlcicpO1xuY29uc3QgTWluaUNzc0V4dHJhY3RQbHVnaW4gPSByZXF1aXJlKCdtaW5pLWNzcy1leHRyYWN0LXBsdWdpbicpO1xuY29uc3QgcG9zdGNzc0ltcG9ydHMgPSByZXF1aXJlKCdwb3N0Y3NzLWltcG9ydCcpO1xuY29uc3QgUG9zdGNzc0NsaVJlc291cmNlcyA9IHJlcXVpcmUoJy4uLy4uL3BsdWdpbnMvd2VicGFjaycpLlBvc3Rjc3NDbGlSZXNvdXJjZXM7XG5cbi8qKlxuICogRW51bWVyYXRlIGxvYWRlcnMgYW5kIHRoZWlyIGRlcGVuZGVuY2llcyBmcm9tIHRoaXMgZmlsZSB0byBsZXQgdGhlIGRlcGVuZGVuY3kgdmFsaWRhdG9yXG4gKiBrbm93IHRoZXkgYXJlIHVzZWQuXG4gKlxuICogcmVxdWlyZSgnc3R5bGUtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ3Bvc3Rjc3MtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ3N0eWx1cycpXG4gKiByZXF1aXJlKCdzdHlsdXMtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ2xlc3MnKVxuICogcmVxdWlyZSgnbGVzcy1sb2FkZXInKVxuICogcmVxdWlyZSgnbm9kZS1zYXNzJylcbiAqIHJlcXVpcmUoJ3Nhc3MtbG9hZGVyJylcbiAqL1xuXG5pbnRlcmZhY2UgUG9zdGNzc1VybEFzc2V0IHtcbiAgdXJsOiBzdHJpbmc7XG4gIGhhc2g6IHN0cmluZztcbiAgYWJzb2x1dGVQYXRoOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdHlsZXNDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuICBjb25zdCB7IHJvb3QsIHByb2plY3RSb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcblxuICAvLyBjb25zdCBhcHBSb290ID0gcGF0aC5yZXNvbHZlKHByb2plY3RSb290LCBhcHBDb25maWcucm9vdCk7XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZ1tdIH0gPSB7fTtcbiAgY29uc3QgZ2xvYmFsU3R5bGVQYXRoczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiBhbnlbXSA9IFtdO1xuICBjb25zdCBjc3NTb3VyY2VNYXAgPSBidWlsZE9wdGlvbnMuc291cmNlTWFwO1xuXG4gIC8vIE1heGltdW0gcmVzb3VyY2Ugc2l6ZSB0byBpbmxpbmUgKEtpQilcbiAgY29uc3QgbWF4aW11bUlubGluZVNpemUgPSAxMDtcbiAgLy8gRGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0LlxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyBhcyBzdHJpbmcpO1xuICAvLyBDb252ZXJ0IGFic29sdXRlIHJlc291cmNlIFVSTHMgdG8gYWNjb3VudCBmb3IgYmFzZS1ocmVmIGFuZCBkZXBsb3ktdXJsLlxuICBjb25zdCBiYXNlSHJlZiA9IHdjby5idWlsZE9wdGlvbnMuYmFzZUhyZWYgfHwgJyc7XG4gIGNvbnN0IGRlcGxveVVybCA9IHdjby5idWlsZE9wdGlvbnMuZGVwbG95VXJsIHx8ICcnO1xuXG4gIGNvbnN0IHBvc3Rjc3NQbHVnaW5DcmVhdG9yID0gZnVuY3Rpb24gKGxvYWRlcjogd2VicGFjay5sb2FkZXIuTG9hZGVyQ29udGV4dCkge1xuICAgIHJldHVybiBbXG4gICAgICBwb3N0Y3NzSW1wb3J0cyh7XG4gICAgICAgIHJlc29sdmU6ICh1cmw6IHN0cmluZywgY29udGV4dDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgbGV0IGhhZFRpbGRlID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAodXJsICYmIHVybC5zdGFydHNXaXRoKCd+JykpIHtcbiAgICAgICAgICAgICAgdXJsID0gdXJsLnN1YnN0cigxKTtcbiAgICAgICAgICAgICAgaGFkVGlsZGUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9hZGVyLnJlc29sdmUoY29udGV4dCwgKGhhZFRpbGRlID8gJycgOiAnLi8nKSArIHVybCwgKGVycjogRXJyb3IsIHJlc3VsdDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoaGFkVGlsZGUpIHtcbiAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsb2FkZXIucmVzb2x2ZShjb250ZXh0LCB1cmwsIChlcnI6IEVycm9yLCByZXN1bHQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBsb2FkOiAoZmlsZW5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGxvYWRlci5mcy5yZWFkRmlsZShmaWxlbmFtZSwgKGVycjogRXJyb3IsIGRhdGE6IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShjb250ZW50KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIHBvc3Rjc3NVcmwoe1xuICAgICAgICBmaWx0ZXI6ICh7IHVybCB9OiBQb3N0Y3NzVXJsQXNzZXQpID0+IHVybC5zdGFydHNXaXRoKCd+JyksXG4gICAgICAgIHVybDogKHsgdXJsIH06IFBvc3Rjc3NVcmxBc3NldCkgPT4ge1xuICAgICAgICAgIC8vIE5vdGU6IFRoaXMgd2lsbCBvbmx5IGZpbmQgdGhlIGZpcnN0IG5vZGVfbW9kdWxlcyBmb2xkZXIuXG4gICAgICAgICAgY29uc3Qgbm9kZU1vZHVsZXMgPSBmaW5kVXAoJ25vZGVfbW9kdWxlcycsIHByb2plY3RSb290KTtcbiAgICAgICAgICBpZiAoIW5vZGVNb2R1bGVzKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBsb2NhdGUgbm9kZV9tb2R1bGVzIGRpcmVjdG9yeS4nKVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihub2RlTW9kdWxlcywgdXJsLnN1YnN0cigxKSk7XG4gICAgICAgICAgcmV0dXJuIHBhdGgucmVsYXRpdmUobG9hZGVyLmNvbnRleHQsIGZ1bGxQYXRoKS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgcG9zdGNzc1VybChbXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBPbmx5IGNvbnZlcnQgcm9vdCByZWxhdGl2ZSBVUkxzLCB3aGljaCBDU1MtTG9hZGVyIHdvbid0IHByb2Nlc3MgaW50byByZXF1aXJlKCkuXG4gICAgICAgICAgZmlsdGVyOiAoeyB1cmwgfTogUG9zdGNzc1VybEFzc2V0KSA9PiB1cmwuc3RhcnRzV2l0aCgnLycpICYmICF1cmwuc3RhcnRzV2l0aCgnLy8nKSxcbiAgICAgICAgICB1cmw6ICh7IHVybCB9OiBQb3N0Y3NzVXJsQXNzZXQpID0+IHtcbiAgICAgICAgICAgIGlmIChkZXBsb3lVcmwubWF0Y2goLzpcXC9cXC8vKSB8fCBkZXBsb3lVcmwuc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgICAgICAgICAgIC8vIElmIGRlcGxveVVybCBpcyBhYnNvbHV0ZSBvciByb290IHJlbGF0aXZlLCBpZ25vcmUgYmFzZUhyZWYgJiB1c2UgZGVwbG95VXJsIGFzIGlzLlxuICAgICAgICAgICAgICByZXR1cm4gYCR7ZGVwbG95VXJsLnJlcGxhY2UoL1xcLyQvLCAnJyl9JHt1cmx9YDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYmFzZUhyZWYubWF0Y2goLzpcXC9cXC8vKSkge1xuICAgICAgICAgICAgICAvLyBJZiBiYXNlSHJlZiBjb250YWlucyBhIHNjaGVtZSwgaW5jbHVkZSBpdCBhcyBpcy5cbiAgICAgICAgICAgICAgcmV0dXJuIGJhc2VIcmVmLnJlcGxhY2UoL1xcLyQvLCAnJykgK1xuICAgICAgICAgICAgICAgIGAvJHtkZXBsb3lVcmx9LyR7dXJsfWAucmVwbGFjZSgvXFwvXFwvKy9nLCAnLycpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gSm9pbiB0b2dldGhlciBiYXNlLWhyZWYsIGRlcGxveS11cmwgYW5kIHRoZSBvcmlnaW5hbCBVUkwuXG4gICAgICAgICAgICAgIC8vIEFsc28gZGVkdXBlIG11bHRpcGxlIHNsYXNoZXMgaW50byBzaW5nbGUgb25lcy5cbiAgICAgICAgICAgICAgcmV0dXJuIGAvJHtiYXNlSHJlZn0vJHtkZXBsb3lVcmx9LyR7dXJsfWAucmVwbGFjZSgvXFwvXFwvKy9nLCAnLycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIC8vIFRPRE86IGlubGluZSAuY3VyIGlmIG5vdCBzdXBwb3J0aW5nIElFICh1c2UgYnJvd3NlcnNsaXN0IHRvIGNoZWNrKVxuICAgICAgICAgIGZpbHRlcjogKGFzc2V0OiBQb3N0Y3NzVXJsQXNzZXQpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBtYXhpbXVtSW5saW5lU2l6ZSA+IDAgJiYgIWFzc2V0Lmhhc2ggJiYgIWFzc2V0LmFic29sdXRlUGF0aC5lbmRzV2l0aCgnLmN1cicpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdXJsOiAnaW5saW5lJyxcbiAgICAgICAgICAvLyBOT1RFOiBtYXhTaXplIGlzIGluIEtCXG4gICAgICAgICAgbWF4U2l6ZTogbWF4aW11bUlubGluZVNpemUsXG4gICAgICAgICAgZmFsbGJhY2s6ICdyZWJhc2UnLFxuICAgICAgICB9LFxuICAgICAgICB7IHVybDogJ3JlYmFzZScgfSxcbiAgICAgIF0pLFxuICAgICAgUG9zdGNzc0NsaVJlc291cmNlcyh7XG4gICAgICAgIGRlcGxveVVybDogbG9hZGVyLmxvYWRlcnNbbG9hZGVyLmxvYWRlckluZGV4XS5vcHRpb25zLmlkZW50ID09ICdleHRyYWN0ZWQnID8gJycgOiBkZXBsb3lVcmwsXG4gICAgICAgIGxvYWRlcixcbiAgICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuZmlsZX0uW2V4dF1gLFxuICAgICAgfSksXG4gICAgICBhdXRvcHJlZml4ZXIoeyBncmlkOiB0cnVlIH0pLFxuICAgIF07XG4gIH07XG5cbiAgLy8gdXNlIGluY2x1ZGVQYXRocyBmcm9tIGFwcENvbmZpZ1xuICBjb25zdCBpbmNsdWRlUGF0aHM6IHN0cmluZ1tdID0gW107XG4gIGxldCBsZXNzUGF0aE9wdGlvbnM6IHsgcGF0aHM/OiBzdHJpbmdbXSB9ID0ge307XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnNcbiAgICAmJiBidWlsZE9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLmluY2x1ZGVQYXRoc1xuICAgICYmIGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMuaW5jbHVkZVBhdGhzLmxlbmd0aCA+IDBcbiAgKSB7XG4gICAgYnVpbGRPcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucy5pbmNsdWRlUGF0aHMuZm9yRWFjaCgoaW5jbHVkZVBhdGg6IHN0cmluZykgPT5cbiAgICAgIGluY2x1ZGVQYXRocy5wdXNoKHBhdGgucmVzb2x2ZShyb290LCBpbmNsdWRlUGF0aCkpKTtcbiAgICBsZXNzUGF0aE9wdGlvbnMgPSB7XG4gICAgICBwYXRoczogaW5jbHVkZVBhdGhzLFxuICAgIH07XG4gIH1cblxuICAvLyBQcm9jZXNzIGdsb2JhbCBzdHlsZXMuXG4gIGlmIChidWlsZE9wdGlvbnMuc3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBjaHVua0lkczogc3RyaW5nW10gPSBbXTtcblxuICAgIG5vcm1hbGl6ZUV4dHJhRW50cnlQb2ludHMoYnVpbGRPcHRpb25zLnN0eWxlcywgJ3N0eWxlcycpLmZvckVhY2goc3R5bGUgPT4ge1xuICAgICAgY29uc3QgcmVzb2x2ZWRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIHN0eWxlLmlucHV0KTtcblxuICAgICAgLy8gQWRkIHN0eWxlIGVudHJ5IHBvaW50cy5cbiAgICAgIGlmIChlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXSkge1xuICAgICAgICBlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXS5wdXNoKHJlc29sdmVkUGF0aClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVudHJ5UG9pbnRzW3N0eWxlLmJ1bmRsZU5hbWVdID0gW3Jlc29sdmVkUGF0aF1cbiAgICAgIH1cblxuICAgICAgLy8gQWRkIGxhenkgc3R5bGVzIHRvIHRoZSBsaXN0LlxuICAgICAgaWYgKHN0eWxlLmxhenkpIHtcbiAgICAgICAgY2h1bmtJZHMucHVzaChzdHlsZS5idW5kbGVOYW1lKTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIGdsb2JhbCBjc3MgcGF0aHMuXG4gICAgICBnbG9iYWxTdHlsZVBhdGhzLnB1c2gocmVzb2x2ZWRQYXRoKTtcbiAgICB9KTtcblxuICAgIGlmIChjaHVua0lkcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBBZGQgcGx1Z2luIHRvIHJlbW92ZSBoYXNoZXMgZnJvbSBsYXp5IHN0eWxlcy5cbiAgICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBSZW1vdmVIYXNoUGx1Z2luKHsgY2h1bmtJZHMsIGhhc2hGb3JtYXR9KSk7XG4gICAgfVxuICB9XG5cbiAgLy8gc2V0IGJhc2UgcnVsZXMgdG8gZGVyaXZlIGZpbmFsIHJ1bGVzIGZyb21cbiAgY29uc3QgYmFzZVJ1bGVzOiB3ZWJwYWNrLlJ1bGVbXSA9IFtcbiAgICB7IHRlc3Q6IC9cXC5jc3MkLywgdXNlOiBbXSB9LFxuICAgIHtcbiAgICAgIHRlc3Q6IC9cXC5zY3NzJHxcXC5zYXNzJC8sIHVzZTogW3tcbiAgICAgICAgbG9hZGVyOiAnc2Fzcy1sb2FkZXInLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgLy8gYm9vdHN0cmFwLXNhc3MgcmVxdWlyZXMgYSBtaW5pbXVtIHByZWNpc2lvbiBvZiA4XG4gICAgICAgICAgcHJlY2lzaW9uOiA4LFxuICAgICAgICAgIGluY2x1ZGVQYXRoc1xuICAgICAgICB9XG4gICAgICB9XVxuICAgIH0sXG4gICAge1xuICAgICAgdGVzdDogL1xcLmxlc3MkLywgdXNlOiBbe1xuICAgICAgICBsb2FkZXI6ICdsZXNzLWxvYWRlcicsXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICBqYXZhc2NyaXB0RW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAuLi5sZXNzUGF0aE9wdGlvbnMsXG4gICAgICAgIH1cbiAgICAgIH1dXG4gICAgfSxcbiAgICB7XG4gICAgICB0ZXN0OiAvXFwuc3R5bCQvLCB1c2U6IFt7XG4gICAgICAgIGxvYWRlcjogJ3N0eWx1cy1sb2FkZXInLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgcGF0aHM6IGluY2x1ZGVQYXRoc1xuICAgICAgICB9XG4gICAgICB9XVxuICAgIH1cbiAgXTtcblxuICAvLyBsb2FkIGNvbXBvbmVudCBjc3MgYXMgcmF3IHN0cmluZ3NcbiAgY29uc3QgcnVsZXM6IHdlYnBhY2suUnVsZVtdID0gYmFzZVJ1bGVzLm1hcCgoeyB0ZXN0LCB1c2UgfSkgPT4gKHtcbiAgICBleGNsdWRlOiBnbG9iYWxTdHlsZVBhdGhzLCB0ZXN0LCB1c2U6IFtcbiAgICAgIHsgbG9hZGVyOiAncmF3LWxvYWRlcicgfSxcbiAgICAgIHtcbiAgICAgICAgbG9hZGVyOiAncG9zdGNzcy1sb2FkZXInLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgaWRlbnQ6ICdlbWJlZGRlZCcsXG4gICAgICAgICAgcGx1Z2luczogcG9zdGNzc1BsdWdpbkNyZWF0b3IsXG4gICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXBcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIC4uLih1c2UgYXMgd2VicGFjay5Mb2FkZXJbXSlcbiAgICBdXG4gIH0pKTtcblxuICAvLyBsb2FkIGdsb2JhbCBjc3MgYXMgY3NzIGZpbGVzXG4gIGlmIChnbG9iYWxTdHlsZVBhdGhzLmxlbmd0aCA+IDApIHtcbiAgICBydWxlcy5wdXNoKC4uLmJhc2VSdWxlcy5tYXAoKHsgdGVzdCwgdXNlIH0pID0+IHtcbiAgICAgIGNvbnN0IGV4dHJhY3RUZXh0UGx1Z2luID0ge1xuICAgICAgICB1c2U6IFtcbiAgICAgICAgICAvLyBzdHlsZS1sb2FkZXIgc3RpbGwgaGFzIGlzc3VlcyB3aXRoIHJlbGF0aXZlIHVybCgpJ3Mgd2l0aCBzb3VyY2VtYXBzIGVuYWJsZWQ7XG4gICAgICAgICAgLy8gZXZlbiB3aXRoIHRoZSBjb252ZXJ0VG9BYnNvbHV0ZVVybHMgb3B0aW9ucyBhcyBpdCB1c2VzICdkb2N1bWVudC5sb2NhdGlvbidcbiAgICAgICAgICAvLyB3aGljaCBicmVha3Mgd2hlbiB1c2VkIHdpdGggcm91dGluZy5cbiAgICAgICAgICAvLyBPbmNlIHN0eWxlLWxvYWRlciAxLjAgaXMgcmVsZWFzZWQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25hbCB3b24ndCBiZSBuZWNlc3NhcnlcbiAgICAgICAgICAvLyBkdWUgdG8gdGhpcyAxLjAgUFI6IGh0dHBzOi8vZ2l0aHViLmNvbS93ZWJwYWNrLWNvbnRyaWIvc3R5bGUtbG9hZGVyL3B1bGwvMjE5XG4gICAgICAgICAgeyBsb2FkZXI6IGJ1aWxkT3B0aW9ucy5leHRyYWN0Q3NzID8gUmF3Q3NzTG9hZGVyIDogJ3Jhdy1sb2FkZXInIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgbG9hZGVyOiAncG9zdGNzcy1sb2FkZXInLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBpZGVudDogYnVpbGRPcHRpb25zLmV4dHJhY3RDc3MgPyAnZXh0cmFjdGVkJyA6ICdlbWJlZGRlZCcsXG4gICAgICAgICAgICAgIHBsdWdpbnM6IHBvc3Rjc3NQbHVnaW5DcmVhdG9yLFxuICAgICAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgLi4uKHVzZSBhcyB3ZWJwYWNrLkxvYWRlcltdKVxuICAgICAgICBdLFxuICAgICAgICAvLyBwdWJsaWNQYXRoIG5lZWRlZCBhcyBhIHdvcmthcm91bmQgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzQwMzVcbiAgICAgICAgcHVibGljUGF0aDogJydcbiAgICAgIH07XG4gICAgICBjb25zdCByZXQ6IGFueSA9IHtcbiAgICAgICAgaW5jbHVkZTogZ2xvYmFsU3R5bGVQYXRocyxcbiAgICAgICAgdGVzdCxcbiAgICAgICAgdXNlOiBbXG4gICAgICAgICAgYnVpbGRPcHRpb25zLmV4dHJhY3RDc3MgPyBNaW5pQ3NzRXh0cmFjdFBsdWdpbi5sb2FkZXIgOiAnc3R5bGUtbG9hZGVyJyxcbiAgICAgICAgICAuLi5leHRyYWN0VGV4dFBsdWdpbi51c2UsXG4gICAgICAgIF1cbiAgICAgIH07XG4gICAgICAvLyBTYXZlIHRoZSBvcmlnaW5hbCBvcHRpb25zIGFzIGFyZ3VtZW50cyBmb3IgZWplY3QuXG4gICAgICAvLyBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RDc3MpIHtcbiAgICAgIC8vICAgcmV0W3BsdWdpbkFyZ3NdID0gZXh0cmFjdFRleHRQbHVnaW47XG4gICAgICAvLyB9XG4gICAgICByZXR1cm4gcmV0O1xuICAgIH0pKTtcbiAgfVxuXG4gIGlmIChidWlsZE9wdGlvbnMuZXh0cmFjdENzcykge1xuICAgIC8vIGV4dHJhY3QgZ2xvYmFsIGNzcyBmcm9tIGpzIGZpbGVzIGludG8gb3duIGNzcyBmaWxlXG4gICAgZXh0cmFQbHVnaW5zLnB1c2goXG4gICAgICBuZXcgTWluaUNzc0V4dHJhY3RQbHVnaW4oeyBmaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5leHRyYWN0fS5jc3NgIH0pKTtcbiAgICAvLyBzdXBwcmVzcyBlbXB0eSAuanMgZmlsZXMgaW4gY3NzIG9ubHkgZW50cnkgcG9pbnRzXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4oKSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBtb2R1bGU6IHsgcnVsZXMgfSxcbiAgICBwbHVnaW5zOiBbXS5jb25jYXQoZXh0cmFQbHVnaW5zIGFzIGFueSlcbiAgfTtcbn1cbiJdfQ==