"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const webpack_1 = require("../../plugins/webpack");
const utils_1 = require("./utils");
const find_up_1 = require("../../utilities/find-up");
const webpack_2 = require("../../plugins/webpack");
const utils_2 = require("./utils");
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
    let lessPathOptions = { paths: [] };
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
        buildOptions.styles.forEach(style => {
            const bundleName = utils_2.computeBundleName(style, 'styles');
            ;
            const resolvedPath = path.resolve(root, style.input);
            // Add style entry points.
            if (entryPoints[bundleName]) {
                entryPoints[bundleName].push(resolvedPath);
            }
            else {
                entryPoints[bundleName] = [resolvedPath];
            }
            // Add global css paths.
            globalStylePaths.push(resolvedPath);
        });
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
                    options: Object.assign({ sourceMap: cssSourceMap }, lessPathOptions)
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
                    { loader: webpack_2.RawCssLoader },
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
        extraPlugins.push(new MiniCssExtractPlugin({ filename: `[name]${hashFormat.script}.css` }));
        // suppress empty .js files in css only entry points
        extraPlugins.push(new webpack_1.SuppressExtractedTextChunksWebpackPlugin());
    }
    return {
        // Workaround stylus-loader defect: https://github.com/shama/stylus-loader/issues/189
        loader: { stylus: {} },
        entry: entryPoints,
        module: { rules },
        plugins: [].concat(extraPlugins)
    };
}
exports.getStylesConfig = getStylesConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFHL0QsNkJBQTZCO0FBQzdCLG1EQUFpRjtBQUNqRixtQ0FBOEM7QUFFOUMscURBQWlEO0FBQ2pELG1EQUFxRDtBQUVyRCxtQ0FBNEM7QUFFNUMsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQzFDLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUM3QyxNQUFNLG9CQUFvQixHQUFHLE9BQU8sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ2hFLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0FBQ2pELE1BQU0sbUJBQW1CLEdBQUcsT0FBTyxDQUFDLHVCQUF1QixDQUFDLENBQUMsbUJBQW1CLENBQUM7QUF3QmpGLHlCQUFnQyxHQUF5QjtJQUN2RCxNQUFNLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFFaEQsNkRBQTZEO0lBQzdELE1BQU0sV0FBVyxHQUFnQyxFQUFFLENBQUM7SUFDcEQsTUFBTSxnQkFBZ0IsR0FBYSxFQUFFLENBQUM7SUFDdEMsTUFBTSxZQUFZLEdBQVUsRUFBRSxDQUFDO0lBQy9CLE1BQU0sWUFBWSxHQUFHLFlBQVksQ0FBQyxTQUFTLENBQUM7SUFFNUMsd0NBQXdDO0lBQ3hDLE1BQU0saUJBQWlCLEdBQUcsRUFBRSxDQUFDO0lBQzdCLDRCQUE0QjtJQUM1QixNQUFNLFVBQVUsR0FBRywyQkFBbUIsQ0FBQyxZQUFZLENBQUMsYUFBdUIsQ0FBQyxDQUFDO0lBQzdFLDBFQUEwRTtJ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LElBQUksQ0FDZixJQUFJLG9CQUFvQixDQUFDLEVBQUUsUUFBUSxFQUFFLFNBQVMsVUFBVSxDQUFDLE1BQU0sTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVFLG9EQUFvRDtRQUNwRCxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksa0RBQXdDLEVBQUUsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFRCxNQUFNLENBQUM7UUFDTCxxRkFBcUY7UUFDckYsTUFBTSxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRTtRQUN0QixLQUFLLEVBQUUsV0FBVztRQUNsQixNQUFNLEVBQUUsRUFBRSxLQUFLLEVBQUU7UUFDakIsT0FBTyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBbUIsQ0FBQztLQUN4QyxDQUFDO0FBQ0osQ0FBQztBQXJQRCwwQ0FxUEMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyB0c2xpbnQ6ZGlzYWJsZVxuLy8gVE9ETzogY2xlYW51cCB0aGlzIGZpbGUsIGl0J3MgY29waWVkIGFzIGlzIGZyb20gQW5ndWxhciBDTEkuXG5cbmltcG9ydCAqIGFzIHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgU3VwcHJlc3NFeHRyYWN0ZWRUZXh0Q2h1bmtzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvd2VicGFjayc7XG5pbXBvcnQgeyBnZXRPdXRwdXRIYXNoRm9ybWF0IH0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgZmluZFVwIH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL2ZpbmQtdXAnO1xuaW1wb3J0IHsgUmF3Q3NzTG9hZGVyIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy93ZWJwYWNrJztcbmltcG9ydCB7IEV4dHJhRW50cnlQb2ludCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXInO1xuaW1wb3J0IHsgY29tcHV0ZUJ1bmRsZU5hbWUgfSBmcm9tICcuL3V0aWxzJztcblxuY29uc3QgcG9zdGNzc1VybCA9IHJlcXVpcmUoJ3Bvc3Rjc3MtdXJsJyk7XG5jb25zdCBhdXRvcHJlZml4ZXIgPSByZXF1aXJlKCdhdXRvcHJlZml4ZXInKTtcbmNvbnN0IE1pbmlDc3NFeHRyYWN0UGx1Z2luID0gcmVxdWlyZSgnbWluaS1jc3MtZXh0cmFjdC1wbHVnaW4nKTtcbmNvbnN0IHBvc3Rjc3NJbXBvcnRzID0gcmVxdWlyZSgncG9zdGNzcy1pbXBvcnQnKTtcbmNvbnN0IFBvc3Rjc3NDbGlSZXNvdXJjZXMgPSByZXF1aXJlKCcuLi8uLi9wbHVnaW5zL3dlYnBhY2snKS5Qb3N0Y3NzQ2xpUmVzb3VyY2VzO1xuXG4vKipcbiAqIEVudW1lcmF0ZSBsb2FkZXJzIGFuZCB0aGVpciBkZXBlbmRlbmNpZXMgZnJvbSB0aGlzIGZpbGUgdG8gbGV0IHRoZSBkZXBlbmRlbmN5IHZhbGlkYXRvclxuICoga25vdyB0aGV5IGFyZSB1c2VkLlxuICpcbiAqIHJlcXVpcmUoJ2V4cG9ydHMtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ3N0eWxlLWxvYWRlcicpXG4gKiByZXF1aXJlKCdwb3N0Y3NzLWxvYWRlcicpXG4gKiByZXF1aXJlKCdjc3MtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ3N0eWx1cycpXG4gKiByZXF1aXJlKCdzdHlsdXMtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ2xlc3MnKVxuICogcmVxdWlyZSgnbGVzcy1sb2FkZXInKVxuICogcmVxdWlyZSgnbm9kZS1zYXNzJylcbiAqIHJlcXVpcmUoJ3Nhc3MtbG9hZGVyJylcbiAqL1xuXG5pbnRlcmZhY2UgUG9zdGNzc1VybEFzc2V0IHtcbiAgdXJsOiBzdHJpbmc7XG4gIGhhc2g6IHN0cmluZztcbiAgYWJzb2x1dGVQYXRoOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdHlsZXNDb25maWcod2NvOiBXZWJwYWNrQ29uZmlnT3B0aW9ucykge1xuICBjb25zdCB7IHJvb3QsIHByb2plY3RSb290LCBidWlsZE9wdGlvbnMgfSA9IHdjbztcblxuICAvLyBjb25zdCBhcHBSb290ID0gcGF0aC5yZXNvbHZlKHByb2plY3RSb290LCBhcHBDb25maWcucm9vdCk7XG4gIGNvbnN0IGVudHJ5UG9pbnRzOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZ1tdIH0gPSB7fTtcbiAgY29uc3QgZ2xvYmFsU3R5bGVQYXRoczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgZXh0cmFQbHVnaW5zOiBhbnlbXSA9IFtdO1xuICBjb25zdCBjc3NTb3VyY2VNYXAgPSBidWlsZE9wdGlvbnMuc291cmNlTWFwO1xuXG4gIC8vIE1heGltdW0gcmVzb3VyY2Ugc2l6ZSB0byBpbmxpbmUgKEtpQilcbiAgY29uc3QgbWF4aW11bUlubGluZVNpemUgPSAxMDtcbiAgLy8gRGV0ZXJtaW5lIGhhc2hpbmcgZm9ybWF0LlxuICBjb25zdCBoYXNoRm9ybWF0ID0gZ2V0T3V0cHV0SGFzaEZvcm1hdChidWlsZE9wdGlvbnMub3V0cHV0SGFzaGluZyBhcyBzdHJpbmcpO1xuICAvLyBDb252ZXJ0IGFic29sdXRlIHJlc291cmNlIFVSTHMgdG8gYWNjb3VudCBmb3IgYmFzZS1ocmVmIGFuZCBkZXBsb3ktdXJsLlxuICBjb25zdCBiYXNlSHJlZiA9IHdjby5idWlsZE9wdGlvbnMuYmFzZUhyZWYgfHwgJyc7XG4gIGNvbnN0IGRlcGxveVVybCA9IHdjby5idWlsZE9wdGlvbnMuZGVwbG95VXJsIHx8ICcnO1xuXG4gIGNvbnN0IHBvc3Rjc3NQbHVnaW5DcmVhdG9yID0gZnVuY3Rpb24gKGxvYWRlcjogd2VicGFjay5sb2FkZXIuTG9hZGVyQ29udGV4dCkge1xuICAgIHJldHVybiBbXG4gICAgICBwb3N0Y3NzSW1wb3J0cyh7XG4gICAgICAgIHJlc29sdmU6ICh1cmw6IHN0cmluZywgY29udGV4dDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgbGV0IGhhZFRpbGRlID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAodXJsICYmIHVybC5zdGFydHNXaXRoKCd+JykpIHtcbiAgICAgICAgICAgICAgdXJsID0gdXJsLnN1YnN0cigxKTtcbiAgICAgICAgICAgICAgaGFkVGlsZGUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9hZGVyLnJlc29sdmUoY29udGV4dCwgKGhhZFRpbGRlID8gJycgOiAnLi8nKSArIHVybCwgKGVycjogRXJyb3IsIHJlc3VsdDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoaGFkVGlsZGUpIHtcbiAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsb2FkZXIucmVzb2x2ZShjb250ZXh0LCB1cmwsIChlcnI6IEVycm9yLCByZXN1bHQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBsb2FkOiAoZmlsZW5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGxvYWRlci5mcy5yZWFkRmlsZShmaWxlbmFtZSwgKGVycjogRXJyb3IsIGRhdGE6IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgcmVzb2x2ZShjb250ZW50KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIHBvc3Rjc3NVcmwoe1xuICAgICAgICBmaWx0ZXI6ICh7IHVybCB9OiBQb3N0Y3NzVXJsQXNzZXQpID0+IHVybC5zdGFydHNXaXRoKCd+JyksXG4gICAgICAgIHVybDogKHsgdXJsIH06IFBvc3Rjc3NVcmxBc3NldCkgPT4ge1xuICAgICAgICAgIC8vIE5vdGU6IFRoaXMgd2lsbCBvbmx5IGZpbmQgdGhlIGZpcnN0IG5vZGVfbW9kdWxlcyBmb2xkZXIuXG4gICAgICAgICAgY29uc3Qgbm9kZU1vZHVsZXMgPSBmaW5kVXAoJ25vZGVfbW9kdWxlcycsIHByb2plY3RSb290KTtcbiAgICAgICAgICBpZiAoIW5vZGVNb2R1bGVzKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBsb2NhdGUgbm9kZV9tb2R1bGVzIGRpcmVjdG9yeS4nKVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihub2RlTW9kdWxlcywgdXJsLnN1YnN0cigxKSk7XG4gICAgICAgICAgcmV0dXJuIHBhdGgucmVsYXRpdmUobG9hZGVyLmNvbnRleHQsIGZ1bGxQYXRoKS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgcG9zdGNzc1VybChbXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBPbmx5IGNvbnZlcnQgcm9vdCByZWxhdGl2ZSBVUkxzLCB3aGljaCBDU1MtTG9hZGVyIHdvbid0IHByb2Nlc3MgaW50byByZXF1aXJlKCkuXG4gICAgICAgICAgZmlsdGVyOiAoeyB1cmwgfTogUG9zdGNzc1VybEFzc2V0KSA9PiB1cmwuc3RhcnRzV2l0aCgnLycpICYmICF1cmwuc3RhcnRzV2l0aCgnLy8nKSxcbiAgICAgICAgICB1cmw6ICh7IHVybCB9OiBQb3N0Y3NzVXJsQXNzZXQpID0+IHtcbiAgICAgICAgICAgIGlmIChkZXBsb3lVcmwubWF0Y2goLzpcXC9cXC8vKSB8fCBkZXBsb3lVcmwuc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgICAgICAgICAgIC8vIElmIGRlcGxveVVybCBpcyBhYnNvbHV0ZSBvciByb290IHJlbGF0aXZlLCBpZ25vcmUgYmFzZUhyZWYgJiB1c2UgZGVwbG95VXJsIGFzIGlzLlxuICAgICAgICAgICAgICByZXR1cm4gYCR7ZGVwbG95VXJsLnJlcGxhY2UoL1xcLyQvLCAnJyl9JHt1cmx9YDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYmFzZUhyZWYubWF0Y2goLzpcXC9cXC8vKSkge1xuICAgICAgICAgICAgICAvLyBJZiBiYXNlSHJlZiBjb250YWlucyBhIHNjaGVtZSwgaW5jbHVkZSBpdCBhcyBpcy5cbiAgICAgICAgICAgICAgcmV0dXJuIGJhc2VIcmVmLnJlcGxhY2UoL1xcLyQvLCAnJykgK1xuICAgICAgICAgICAgICAgIGAvJHtkZXBsb3lVcmx9LyR7dXJsfWAucmVwbGFjZSgvXFwvXFwvKy9nLCAnLycpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gSm9pbiB0b2dldGhlciBiYXNlLWhyZWYsIGRlcGxveS11cmwgYW5kIHRoZSBvcmlnaW5hbCBVUkwuXG4gICAgICAgICAgICAgIC8vIEFsc28gZGVkdXBlIG11bHRpcGxlIHNsYXNoZXMgaW50byBzaW5nbGUgb25lcy5cbiAgICAgICAgICAgICAgcmV0dXJuIGAvJHtiYXNlSHJlZn0vJHtkZXBsb3lVcmx9LyR7dXJsfWAucmVwbGFjZSgvXFwvXFwvKy9nLCAnLycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIC8vIFRPRE86IGlubGluZSAuY3VyIGlmIG5vdCBzdXBwb3J0aW5nIElFICh1c2UgYnJvd3NlcnNsaXN0IHRvIGNoZWNrKVxuICAgICAgICAgIGZpbHRlcjogKGFzc2V0OiBQb3N0Y3NzVXJsQXNzZXQpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBtYXhpbXVtSW5saW5lU2l6ZSA+IDAgJiYgIWFzc2V0Lmhhc2ggJiYgIWFzc2V0LmFic29sdXRlUGF0aC5lbmRzV2l0aCgnLmN1cicpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdXJsOiAnaW5saW5lJyxcbiAgICAgICAgICAvLyBOT1RFOiBtYXhTaXplIGlzIGluIEtCXG4gICAgICAgICAgbWF4U2l6ZTogbWF4aW11bUlubGluZVNpemUsXG4gICAgICAgICAgZmFsbGJhY2s6ICdyZWJhc2UnLFxuICAgICAgICB9LFxuICAgICAgICB7IHVybDogJ3JlYmFzZScgfSxcbiAgICAgIF0pLFxuICAgICAgUG9zdGNzc0NsaVJlc291cmNlcyh7XG4gICAgICAgIGRlcGxveVVybDogbG9hZGVyLmxvYWRlcnNbbG9hZGVyLmxvYWRlckluZGV4XS5vcHRpb25zLmlkZW50ID09ICdleHRyYWN0ZWQnID8gJycgOiBkZXBsb3lVcmwsXG4gICAgICAgIGxvYWRlcixcbiAgICAgICAgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuZmlsZX0uW2V4dF1gLFxuICAgICAgfSksXG4gICAgICBhdXRvcHJlZml4ZXIoeyBncmlkOiB0cnVlIH0pLFxuICAgIF07XG4gIH07XG5cbiAgLy8gdXNlIGluY2x1ZGVQYXRocyBmcm9tIGFwcENvbmZpZ1xuICBjb25zdCBpbmNsdWRlUGF0aHM6IHN0cmluZ1tdID0gW107XG4gIGxldCBsZXNzUGF0aE9wdGlvbnM6IHsgcGF0aHM6IHN0cmluZ1tdIH0gPSB7IHBhdGhzOiBbXSB9O1xuXG4gIGlmIChidWlsZE9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zXG4gICAgJiYgYnVpbGRPcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucy5pbmNsdWRlUGF0aHNcbiAgICAmJiBidWlsZE9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLmluY2x1ZGVQYXRocy5sZW5ndGggPiAwXG4gICkge1xuICAgIGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMuaW5jbHVkZVBhdGhzLmZvckVhY2goKGluY2x1ZGVQYXRoOiBzdHJpbmcpID0+XG4gICAgICBpbmNsdWRlUGF0aHMucHVzaChwYXRoLnJlc29sdmUocm9vdCwgaW5jbHVkZVBhdGgpKSk7XG4gICAgbGVzc1BhdGhPcHRpb25zID0ge1xuICAgICAgcGF0aHM6IGluY2x1ZGVQYXRocyxcbiAgICB9O1xuICB9XG5cbiAgLy8gUHJvY2VzcyBnbG9iYWwgc3R5bGVzLlxuICBpZiAoYnVpbGRPcHRpb25zLnN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgKGJ1aWxkT3B0aW9ucy5zdHlsZXMgYXMgRXh0cmFFbnRyeVBvaW50W10pLmZvckVhY2goc3R5bGUgPT4ge1xuICAgICAgY29uc3QgYnVuZGxlTmFtZSA9IGNvbXB1dGVCdW5kbGVOYW1lKHN0eWxlLCAnc3R5bGVzJyk7O1xuICAgICAgY29uc3QgcmVzb2x2ZWRQYXRoID0gcGF0aC5yZXNvbHZlKHJvb3QsIHN0eWxlLmlucHV0KTtcblxuICAgICAgLy8gQWRkIHN0eWxlIGVudHJ5IHBvaW50cy5cbiAgICAgIGlmIChlbnRyeVBvaW50c1tidW5kbGVOYW1lXSkge1xuICAgICAgICBlbnRyeVBvaW50c1tidW5kbGVOYW1lXS5wdXNoKHJlc29sdmVkUGF0aClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVudHJ5UG9pbnRzW2J1bmRsZU5hbWVdID0gW3Jlc29sdmVkUGF0aF1cbiAgICAgIH1cblxuICAgICAgLy8gQWRkIGdsb2JhbCBjc3MgcGF0aHMuXG4gICAgICBnbG9iYWxTdHlsZVBhdGhzLnB1c2gocmVzb2x2ZWRQYXRoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIHNldCBiYXNlIHJ1bGVzIHRvIGRlcml2ZSBmaW5hbCBydWxlcyBmcm9tXG4gIGNvbnN0IGJhc2VSdWxlczogd2VicGFjay5OZXdVc2VSdWxlW10gPSBbXG4gICAgeyB0ZXN0OiAvXFwuY3NzJC8sIHVzZTogW10gfSxcbiAgICB7XG4gICAgICB0ZXN0OiAvXFwuc2NzcyR8XFwuc2FzcyQvLCB1c2U6IFt7XG4gICAgICAgIGxvYWRlcjogJ3Nhc3MtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIC8vIGJvb3RzdHJhcC1zYXNzIHJlcXVpcmVzIGEgbWluaW11bSBwcmVjaXNpb24gb2YgOFxuICAgICAgICAgIHByZWNpc2lvbjogOCxcbiAgICAgICAgICBpbmNsdWRlUGF0aHNcbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9LFxuICAgIHtcbiAgICAgIHRlc3Q6IC9cXC5sZXNzJC8sIHVzZTogW3tcbiAgICAgICAgbG9hZGVyOiAnbGVzcy1sb2FkZXInLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgLi4ubGVzc1BhdGhPcHRpb25zLFxuICAgICAgICB9XG4gICAgICB9XVxuICAgIH0sXG4gICAge1xuICAgICAgdGVzdDogL1xcLnN0eWwkLywgdXNlOiBbe1xuICAgICAgICBsb2FkZXI6ICdzdHlsdXMtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIHBhdGhzOiBpbmNsdWRlUGF0aHNcbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9XG4gIF07XG5cbiAgLy8gbG9hZCBjb21wb25lbnQgY3NzIGFzIHJhdyBzdHJpbmdzXG4gIGNvbnN0IHJ1bGVzOiB3ZWJwYWNrLlJ1bGVbXSA9IGJhc2VSdWxlcy5tYXAoKHsgdGVzdCwgdXNlIH0pID0+ICh7XG4gICAgZXhjbHVkZTogZ2xvYmFsU3R5bGVQYXRocywgdGVzdCwgdXNlOiBbXG4gICAgICB7IGxvYWRlcjogJ3Jhdy1sb2FkZXInIH0sXG4gICAgICB7XG4gICAgICAgIGxvYWRlcjogJ3Bvc3Rjc3MtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIGlkZW50OiAnZW1iZWRkZWQnLFxuICAgICAgICAgIHBsdWdpbnM6IHBvc3Rjc3NQbHVnaW5DcmVhdG9yLFxuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAuLi4odXNlIGFzIHdlYnBhY2suTG9hZGVyW10pXG4gICAgXVxuICB9KSk7XG5cbiAgLy8gbG9hZCBnbG9iYWwgY3NzIGFzIGNzcyBmaWxlc1xuICBpZiAoZ2xvYmFsU3R5bGVQYXRocy5sZW5ndGggPiAwKSB7XG4gICAgcnVsZXMucHVzaCguLi5iYXNlUnVsZXMubWFwKCh7IHRlc3QsIHVzZSB9KSA9PiB7XG4gICAgICBjb25zdCBleHRyYWN0VGV4dFBsdWdpbiA9IHtcbiAgICAgICAgdXNlOiBbXG4gICAgICAgICAgeyBsb2FkZXI6IFJhd0Nzc0xvYWRlciB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGxvYWRlcjogJ3Bvc3Rjc3MtbG9hZGVyJyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgaWRlbnQ6IGJ1aWxkT3B0aW9ucy5leHRyYWN0Q3NzID8gJ2V4dHJhY3RlZCcgOiAnZW1iZWRkZWQnLFxuICAgICAgICAgICAgICBwbHVnaW5zOiBwb3N0Y3NzUGx1Z2luQ3JlYXRvcixcbiAgICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIC4uLih1c2UgYXMgd2VicGFjay5Mb2FkZXJbXSlcbiAgICAgICAgXSxcbiAgICAgICAgLy8gcHVibGljUGF0aCBuZWVkZWQgYXMgYSB3b3JrYXJvdW5kIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy80MDM1XG4gICAgICAgIHB1YmxpY1BhdGg6ICcnXG4gICAgICB9O1xuICAgICAgY29uc3QgcmV0OiBhbnkgPSB7XG4gICAgICAgIGluY2x1ZGU6IGdsb2JhbFN0eWxlUGF0aHMsXG4gICAgICAgIHRlc3QsXG4gICAgICAgIHVzZTogW1xuICAgICAgICAgIGJ1aWxkT3B0aW9ucy5leHRyYWN0Q3NzID8gTWluaUNzc0V4dHJhY3RQbHVnaW4ubG9hZGVyIDogJ3N0eWxlLWxvYWRlcicsXG4gICAgICAgICAgLi4uZXh0cmFjdFRleHRQbHVnaW4udXNlLFxuICAgICAgICBdXG4gICAgICB9O1xuICAgICAgLy8gU2F2ZSB0aGUgb3JpZ2luYWwgb3B0aW9ucyBhcyBhcmd1bWVudHMgZm9yIGVqZWN0LlxuICAgICAgLy8gaWYgKGJ1aWxkT3B0aW9ucy5leHRyYWN0Q3NzKSB7XG4gICAgICAvLyAgIHJldFtwbHVnaW5BcmdzXSA9IGV4dHJhY3RUZXh0UGx1Z2luO1xuICAgICAgLy8gfVxuICAgICAgcmV0dXJuIHJldDtcbiAgICB9KSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RDc3MpIHtcbiAgICAvLyBleHRyYWN0IGdsb2JhbCBjc3MgZnJvbSBqcyBmaWxlcyBpbnRvIG93biBjc3MgZmlsZVxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IE1pbmlDc3NFeHRyYWN0UGx1Z2luKHsgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuc2NyaXB0fS5jc3NgIH0pKTtcbiAgICAvLyBzdXBwcmVzcyBlbXB0eSAuanMgZmlsZXMgaW4gY3NzIG9ubHkgZW50cnkgcG9pbnRzXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4oKSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC8vIFdvcmthcm91bmQgc3R5bHVzLWxvYWRlciBkZWZlY3Q6IGh0dHBzOi8vZ2l0aHViLmNvbS9zaGFtYS9zdHlsdXMtbG9hZGVyL2lzc3Vlcy8xODlcbiAgICBsb2FkZXI6IHsgc3R5bHVzOiB7fSB9LFxuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBtb2R1bGU6IHsgcnVsZXMgfSxcbiAgICBwbHVnaW5zOiBbXS5jb25jYXQoZXh0cmFQbHVnaW5zIGFzIGFueSlcbiAgfTtcbn1cbiJdfQ==