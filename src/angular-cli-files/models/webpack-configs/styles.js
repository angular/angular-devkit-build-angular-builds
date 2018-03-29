"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const webpack_1 = require("../../plugins/webpack");
const utils_1 = require("./utils");
const find_up_1 = require("../../utilities/find-up");
const webpack_2 = require("../../plugins/webpack");
const postcssUrl = require('postcss-url');
const autoprefixer = require('autoprefixer');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const postcssImports = require('postcss-import');
const PostcssCliResources = require('../../plugins/webpack').PostcssCliResources;
function getStylesConfig(wco) {
    const { root, projectRoot, buildOptions, appConfig } = wco;
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
    if (appConfig.stylePreprocessorOptions
        && appConfig.stylePreprocessorOptions.includePaths
        && appConfig.stylePreprocessorOptions.includePaths.length > 0) {
        appConfig.stylePreprocessorOptions.includePaths.forEach((includePath) => includePaths.push(path.resolve(root, includePath)));
        lessPathOptions = {
            paths: includePaths,
        };
    }
    // process global styles
    if (appConfig.styles.length > 0) {
        const globalStyles = utils_1.extraEntryParser(appConfig.styles, root, 'styles');
        // add style entry points
        globalStyles.forEach(style => entryPoints[style.entry]
            ? entryPoints[style.entry].push(style.path)
            : entryPoints[style.entry] = [style.path]);
        // add global css paths
        globalStylePaths.push(...globalStyles.map((style) => style.path));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFHL0QsNkJBQTZCO0FBQzdCLG1EQUFpRjtBQUNqRixtQ0FBZ0U7QUFFaEUscURBQWlEO0FBQ2pELG1EQUFxRDtBQUVyRCxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDMUMsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQzdDLE1BQU0sb0JBQW9CLEdBQUcsT0FBTyxDQUFDLHlCQUF5QixDQUFDLENBQUM7QUFDaEUsTUFBTSxjQUFjLEdBQUcsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUM7QUFDakQsTUFBTSxtQkFBbUIsR0FBRyxPQUFPLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQztBQXdCakYseUJBQWdDLEdBQXlCO0lBQ3ZELE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFFM0QsNkRBQTZEO0lBQzdELE1BQU0sV0FBVyxHQUFnQyxFQUFFLENBQUM7SUFDcEQsTUFBTSxnQkFBZ0IsR0FBYSxFQUFFLENBQUM7SUFDdEMsTUFBTSxZQUFZLEdBQVUsRUFBRSxDQUFDO0lBQy9CLE1BQU0sWUFBWSxHQUFHLFlBQVksQ0FBQyxTQUFTLENBQUM7SUFFNUMsd0NBQXdDO0lBQ3hDLE1BQU0saUJBQWlCLEdBQUcsRUFBRSxDQUFDO0lBQzdCLDRCQUE0QjtJQUM1QixNQUFNLFVBQVUsR0FBRywyQkFBbUIsQ0FBQyxZQUFZLENBQUMsYUFBdUIsQ0FBQyxDQUFDO0lBQzdFLDBFQUEwRTtJQUMx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LEVBQUUsU0FBUyxVQUFVLENBQUMsTUFBTSxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUUsb0RBQW9EO1FBQ3BELFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxrREFBd0MsRUFBRSxDQUFDLENBQUM7SUFDcEUsQ0FBQztJQUVELE1BQU0sQ0FBQztRQUNMLHFGQUFxRjtRQUNyRixNQUFNLEVBQUUsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFO1FBQ3RCLEtBQUssRUFBRSxXQUFXO1FBQ2xCLE1BQU0sRUFBRSxFQUFFLEtBQUssRUFBRTtRQUNqQixPQUFPLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxZQUFtQixDQUFDO0tBQ3hDLENBQUM7QUFDSixDQUFDO0FBaFBELDBDQWdQQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIHRzbGludDpkaXNhYmxlXG4vLyBUT0RPOiBjbGVhbnVwIHRoaXMgZmlsZSwgaXQncyBjb3BpZWQgYXMgaXMgZnJvbSBBbmd1bGFyIENMSS5cblxuaW1wb3J0ICogYXMgd2VicGFjayBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy93ZWJwYWNrJztcbmltcG9ydCB7IGV4dHJhRW50cnlQYXJzZXIsIGdldE91dHB1dEhhc2hGb3JtYXQgfSBmcm9tICcuL3V0aWxzJztcbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQgeyBmaW5kVXAgfSBmcm9tICcuLi8uLi91dGlsaXRpZXMvZmluZC11cCc7XG5pbXBvcnQgeyBSYXdDc3NMb2FkZXIgfSBmcm9tICcuLi8uLi9wbHVnaW5zL3dlYnBhY2snO1xuXG5jb25zdCBwb3N0Y3NzVXJsID0gcmVxdWlyZSgncG9zdGNzcy11cmwnKTtcbmNvbnN0IGF1dG9wcmVmaXhlciA9IHJlcXVpcmUoJ2F1dG9wcmVmaXhlcicpO1xuY29uc3QgTWluaUNzc0V4dHJhY3RQbHVnaW4gPSByZXF1aXJlKCdtaW5pLWNzcy1leHRyYWN0LXBsdWdpbicpO1xuY29uc3QgcG9zdGNzc0ltcG9ydHMgPSByZXF1aXJlKCdwb3N0Y3NzLWltcG9ydCcpO1xuY29uc3QgUG9zdGNzc0NsaVJlc291cmNlcyA9IHJlcXVpcmUoJy4uLy4uL3BsdWdpbnMvd2VicGFjaycpLlBvc3Rjc3NDbGlSZXNvdXJjZXM7XG5cbi8qKlxuICogRW51bWVyYXRlIGxvYWRlcnMgYW5kIHRoZWlyIGRlcGVuZGVuY2llcyBmcm9tIHRoaXMgZmlsZSB0byBsZXQgdGhlIGRlcGVuZGVuY3kgdmFsaWRhdG9yXG4gKiBrbm93IHRoZXkgYXJlIHVzZWQuXG4gKlxuICogcmVxdWlyZSgnZXhwb3J0cy1sb2FkZXInKVxuICogcmVxdWlyZSgnc3R5bGUtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ3Bvc3Rjc3MtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ2Nzcy1sb2FkZXInKVxuICogcmVxdWlyZSgnc3R5bHVzJylcbiAqIHJlcXVpcmUoJ3N0eWx1cy1sb2FkZXInKVxuICogcmVxdWlyZSgnbGVzcycpXG4gKiByZXF1aXJlKCdsZXNzLWxvYWRlcicpXG4gKiByZXF1aXJlKCdub2RlLXNhc3MnKVxuICogcmVxdWlyZSgnc2Fzcy1sb2FkZXInKVxuICovXG5cbmludGVyZmFjZSBQb3N0Y3NzVXJsQXNzZXQge1xuICB1cmw6IHN0cmluZztcbiAgaGFzaDogc3RyaW5nO1xuICBhYnNvbHV0ZVBhdGg6IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN0eWxlc0NvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKSB7XG4gIGNvbnN0IHsgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkT3B0aW9ucywgYXBwQ29uZmlnIH0gPSB3Y287XG5cbiAgLy8gY29uc3QgYXBwUm9vdCA9IHBhdGgucmVzb2x2ZShwcm9qZWN0Um9vdCwgYXBwQ29uZmlnLnJvb3QpO1xuICBjb25zdCBlbnRyeVBvaW50czogeyBba2V5OiBzdHJpbmddOiBzdHJpbmdbXSB9ID0ge307XG4gIGNvbnN0IGdsb2JhbFN0eWxlUGF0aHM6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGV4dHJhUGx1Z2luczogYW55W10gPSBbXTtcbiAgY29uc3QgY3NzU291cmNlTWFwID0gYnVpbGRPcHRpb25zLnNvdXJjZU1hcDtcblxuICAvLyBNYXhpbXVtIHJlc291cmNlIHNpemUgdG8gaW5saW5lIChLaUIpXG4gIGNvbnN0IG1heGltdW1JbmxpbmVTaXplID0gMTA7XG4gIC8vIERldGVybWluZSBoYXNoaW5nIGZvcm1hdC5cbiAgY29uc3QgaGFzaEZvcm1hdCA9IGdldE91dHB1dEhhc2hGb3JtYXQoYnVpbGRPcHRpb25zLm91dHB1dEhhc2hpbmcgYXMgc3RyaW5nKTtcbiAgLy8gQ29udmVydCBhYnNvbHV0ZSByZXNvdXJjZSBVUkxzIHRvIGFjY291bnQgZm9yIGJhc2UtaHJlZiBhbmQgZGVwbG95LXVybC5cbiAgY29uc3QgYmFzZUhyZWYgPSB3Y28uYnVpbGRPcHRpb25zLmJhc2VIcmVmIHx8ICcnO1xuICBjb25zdCBkZXBsb3lVcmwgPSB3Y28uYnVpbGRPcHRpb25zLmRlcGxveVVybCB8fCAnJztcblxuICBjb25zdCBwb3N0Y3NzUGx1Z2luQ3JlYXRvciA9IGZ1bmN0aW9uIChsb2FkZXI6IHdlYnBhY2subG9hZGVyLkxvYWRlckNvbnRleHQpIHtcbiAgICByZXR1cm4gW1xuICAgICAgcG9zdGNzc0ltcG9ydHMoe1xuICAgICAgICByZXNvbHZlOiAodXJsOiBzdHJpbmcsIGNvbnRleHQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGxldCBoYWRUaWxkZSA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHVybCAmJiB1cmwuc3RhcnRzV2l0aCgnficpKSB7XG4gICAgICAgICAgICAgIHVybCA9IHVybC5zdWJzdHIoMSk7XG4gICAgICAgICAgICAgIGhhZFRpbGRlID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvYWRlci5yZXNvbHZlKGNvbnRleHQsIChoYWRUaWxkZSA/ICcnIDogJy4vJykgKyB1cmwsIChlcnI6IEVycm9yLCByZXN1bHQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGhhZFRpbGRlKSB7XG4gICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbG9hZGVyLnJlc29sdmUoY29udGV4dCwgdXJsLCAoZXJyOiBFcnJvciwgcmVzdWx0OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgbG9hZDogKGZpbGVuYW1lOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBsb2FkZXIuZnMucmVhZEZpbGUoZmlsZW5hbWUsIChlcnI6IEVycm9yLCBkYXRhOiBCdWZmZXIpID0+IHtcbiAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgIHJlc29sdmUoY29udGVudCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICBwb3N0Y3NzVXJsKHtcbiAgICAgICAgZmlsdGVyOiAoeyB1cmwgfTogUG9zdGNzc1VybEFzc2V0KSA9PiB1cmwuc3RhcnRzV2l0aCgnficpLFxuICAgICAgICB1cmw6ICh7IHVybCB9OiBQb3N0Y3NzVXJsQXNzZXQpID0+IHtcbiAgICAgICAgICAvLyBOb3RlOiBUaGlzIHdpbGwgb25seSBmaW5kIHRoZSBmaXJzdCBub2RlX21vZHVsZXMgZm9sZGVyLlxuICAgICAgICAgIGNvbnN0IG5vZGVNb2R1bGVzID0gZmluZFVwKCdub2RlX21vZHVsZXMnLCBwcm9qZWN0Um9vdCk7XG4gICAgICAgICAgaWYgKCFub2RlTW9kdWxlcykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgbG9jYXRlIG5vZGVfbW9kdWxlcyBkaXJlY3RvcnkuJylcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4obm9kZU1vZHVsZXMsIHVybC5zdWJzdHIoMSkpO1xuICAgICAgICAgIHJldHVybiBwYXRoLnJlbGF0aXZlKGxvYWRlci5jb250ZXh0LCBmdWxsUGF0aCkucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIHBvc3Rjc3NVcmwoW1xuICAgICAgICB7XG4gICAgICAgICAgLy8gT25seSBjb252ZXJ0IHJvb3QgcmVsYXRpdmUgVVJMcywgd2hpY2ggQ1NTLUxvYWRlciB3b24ndCBwcm9jZXNzIGludG8gcmVxdWlyZSgpLlxuICAgICAgICAgIGZpbHRlcjogKHsgdXJsIH06IFBvc3Rjc3NVcmxBc3NldCkgPT4gdXJsLnN0YXJ0c1dpdGgoJy8nKSAmJiAhdXJsLnN0YXJ0c1dpdGgoJy8vJyksXG4gICAgICAgICAgdXJsOiAoeyB1cmwgfTogUG9zdGNzc1VybEFzc2V0KSA9PiB7XG4gICAgICAgICAgICBpZiAoZGVwbG95VXJsLm1hdGNoKC86XFwvXFwvLykgfHwgZGVwbG95VXJsLnN0YXJ0c1dpdGgoJy8nKSkge1xuICAgICAgICAgICAgICAvLyBJZiBkZXBsb3lVcmwgaXMgYWJzb2x1dGUgb3Igcm9vdCByZWxhdGl2ZSwgaWdub3JlIGJhc2VIcmVmICYgdXNlIGRlcGxveVVybCBhcyBpcy5cbiAgICAgICAgICAgICAgcmV0dXJuIGAke2RlcGxveVVybC5yZXBsYWNlKC9cXC8kLywgJycpfSR7dXJsfWA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGJhc2VIcmVmLm1hdGNoKC86XFwvXFwvLykpIHtcbiAgICAgICAgICAgICAgLy8gSWYgYmFzZUhyZWYgY29udGFpbnMgYSBzY2hlbWUsIGluY2x1ZGUgaXQgYXMgaXMuXG4gICAgICAgICAgICAgIHJldHVybiBiYXNlSHJlZi5yZXBsYWNlKC9cXC8kLywgJycpICtcbiAgICAgICAgICAgICAgICBgLyR7ZGVwbG95VXJsfS8ke3VybH1gLnJlcGxhY2UoL1xcL1xcLysvZywgJy8nKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIEpvaW4gdG9nZXRoZXIgYmFzZS1ocmVmLCBkZXBsb3ktdXJsIGFuZCB0aGUgb3JpZ2luYWwgVVJMLlxuICAgICAgICAgICAgICAvLyBBbHNvIGRlZHVwZSBtdWx0aXBsZSBzbGFzaGVzIGludG8gc2luZ2xlIG9uZXMuXG4gICAgICAgICAgICAgIHJldHVybiBgLyR7YmFzZUhyZWZ9LyR7ZGVwbG95VXJsfS8ke3VybH1gLnJlcGxhY2UoL1xcL1xcLysvZywgJy8nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBUT0RPOiBpbmxpbmUgLmN1ciBpZiBub3Qgc3VwcG9ydGluZyBJRSAodXNlIGJyb3dzZXJzbGlzdCB0byBjaGVjaylcbiAgICAgICAgICBmaWx0ZXI6IChhc3NldDogUG9zdGNzc1VybEFzc2V0KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbWF4aW11bUlubGluZVNpemUgPiAwICYmICFhc3NldC5oYXNoICYmICFhc3NldC5hYnNvbHV0ZVBhdGguZW5kc1dpdGgoJy5jdXInKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHVybDogJ2lubGluZScsXG4gICAgICAgICAgLy8gTk9URTogbWF4U2l6ZSBpcyBpbiBLQlxuICAgICAgICAgIG1heFNpemU6IG1heGltdW1JbmxpbmVTaXplLFxuICAgICAgICAgIGZhbGxiYWNrOiAncmViYXNlJyxcbiAgICAgICAgfSxcbiAgICAgICAgeyB1cmw6ICdyZWJhc2UnIH0sXG4gICAgICBdKSxcbiAgICAgIFBvc3Rjc3NDbGlSZXNvdXJjZXMoe1xuICAgICAgICBkZXBsb3lVcmw6IGxvYWRlci5sb2FkZXJzW2xvYWRlci5sb2FkZXJJbmRleF0ub3B0aW9ucy5pZGVudCA9PSAnZXh0cmFjdGVkJyA/ICcnIDogZGVwbG95VXJsLFxuICAgICAgICBsb2FkZXIsXG4gICAgICAgIGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LmZpbGV9LltleHRdYCxcbiAgICAgIH0pLFxuICAgICAgYXV0b3ByZWZpeGVyKHsgZ3JpZDogdHJ1ZSB9KSxcbiAgICBdO1xuICB9O1xuXG4gIC8vIHVzZSBpbmNsdWRlUGF0aHMgZnJvbSBhcHBDb25maWdcbiAgY29uc3QgaW5jbHVkZVBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuICBsZXQgbGVzc1BhdGhPcHRpb25zOiB7IHBhdGhzOiBzdHJpbmdbXSB9ID0geyBwYXRoczogW10gfTtcblxuICBpZiAoYXBwQ29uZmlnLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9uc1xuICAgICYmIGFwcENvbmZpZy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMuaW5jbHVkZVBhdGhzXG4gICAgJiYgYXBwQ29uZmlnLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucy5pbmNsdWRlUGF0aHMubGVuZ3RoID4gMFxuICApIHtcbiAgICBhcHBDb25maWcuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLmluY2x1ZGVQYXRocy5mb3JFYWNoKChpbmNsdWRlUGF0aDogc3RyaW5nKSA9PlxuICAgICAgaW5jbHVkZVBhdGhzLnB1c2gocGF0aC5yZXNvbHZlKHJvb3QsIGluY2x1ZGVQYXRoKSkpO1xuICAgIGxlc3NQYXRoT3B0aW9ucyA9IHtcbiAgICAgIHBhdGhzOiBpbmNsdWRlUGF0aHMsXG4gICAgfTtcbiAgfVxuXG4gIC8vIHByb2Nlc3MgZ2xvYmFsIHN0eWxlc1xuICBpZiAoYXBwQ29uZmlnLnN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgZ2xvYmFsU3R5bGVzID0gZXh0cmFFbnRyeVBhcnNlcihhcHBDb25maWcuc3R5bGVzLCByb290LCAnc3R5bGVzJyk7XG4gICAgLy8gYWRkIHN0eWxlIGVudHJ5IHBvaW50c1xuICAgIGdsb2JhbFN0eWxlcy5mb3JFYWNoKHN0eWxlID0+XG4gICAgICBlbnRyeVBvaW50c1tzdHlsZS5lbnRyeSBhcyBhbnldXG4gICAgICAgID8gZW50cnlQb2ludHNbc3R5bGUuZW50cnkgYXMgYW55XS5wdXNoKHN0eWxlLnBhdGggYXMgc3RyaW5nKVxuICAgICAgICA6IGVudHJ5UG9pbnRzW3N0eWxlLmVudHJ5IGFzIGFueV0gPSBbc3R5bGUucGF0aCBhcyBhbnldXG4gICAgKTtcbiAgICAvLyBhZGQgZ2xvYmFsIGNzcyBwYXRoc1xuICAgIGdsb2JhbFN0eWxlUGF0aHMucHVzaCguLi5nbG9iYWxTdHlsZXMubWFwKChzdHlsZSkgPT4gc3R5bGUucGF0aCBhcyBhbnkpKTtcbiAgfVxuXG4gIC8vIHNldCBiYXNlIHJ1bGVzIHRvIGRlcml2ZSBmaW5hbCBydWxlcyBmcm9tXG4gIGNvbnN0IGJhc2VSdWxlczogd2VicGFjay5OZXdVc2VSdWxlW10gPSBbXG4gICAgeyB0ZXN0OiAvXFwuY3NzJC8sIHVzZTogW10gfSxcbiAgICB7XG4gICAgICB0ZXN0OiAvXFwuc2NzcyR8XFwuc2FzcyQvLCB1c2U6IFt7XG4gICAgICAgIGxvYWRlcjogJ3Nhc3MtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIC8vIGJvb3RzdHJhcC1zYXNzIHJlcXVpcmVzIGEgbWluaW11bSBwcmVjaXNpb24gb2YgOFxuICAgICAgICAgIHByZWNpc2lvbjogOCxcbiAgICAgICAgICBpbmNsdWRlUGF0aHNcbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9LFxuICAgIHtcbiAgICAgIHRlc3Q6IC9cXC5sZXNzJC8sIHVzZTogW3tcbiAgICAgICAgbG9hZGVyOiAnbGVzcy1sb2FkZXInLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXAsXG4gICAgICAgICAgLi4ubGVzc1BhdGhPcHRpb25zLFxuICAgICAgICB9XG4gICAgICB9XVxuICAgIH0sXG4gICAge1xuICAgICAgdGVzdDogL1xcLnN0eWwkLywgdXNlOiBbe1xuICAgICAgICBsb2FkZXI6ICdzdHlsdXMtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIHBhdGhzOiBpbmNsdWRlUGF0aHNcbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9XG4gIF07XG5cbiAgLy8gbG9hZCBjb21wb25lbnQgY3NzIGFzIHJhdyBzdHJpbmdzXG4gIGNvbnN0IHJ1bGVzOiB3ZWJwYWNrLlJ1bGVbXSA9IGJhc2VSdWxlcy5tYXAoKHsgdGVzdCwgdXNlIH0pID0+ICh7XG4gICAgZXhjbHVkZTogZ2xvYmFsU3R5bGVQYXRocywgdGVzdCwgdXNlOiBbXG4gICAgICB7IGxvYWRlcjogJ3Jhdy1sb2FkZXInIH0sXG4gICAgICB7XG4gICAgICAgIGxvYWRlcjogJ3Bvc3Rjc3MtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIGlkZW50OiAnZW1iZWRkZWQnLFxuICAgICAgICAgIHBsdWdpbnM6IHBvc3Rjc3NQbHVnaW5DcmVhdG9yLFxuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAuLi4odXNlIGFzIHdlYnBhY2suTG9hZGVyW10pXG4gICAgXVxuICB9KSk7XG5cbiAgLy8gbG9hZCBnbG9iYWwgY3NzIGFzIGNzcyBmaWxlc1xuICBpZiAoZ2xvYmFsU3R5bGVQYXRocy5sZW5ndGggPiAwKSB7XG4gICAgcnVsZXMucHVzaCguLi5iYXNlUnVsZXMubWFwKCh7IHRlc3QsIHVzZSB9KSA9PiB7XG4gICAgICBjb25zdCBleHRyYWN0VGV4dFBsdWdpbiA9IHtcbiAgICAgICAgdXNlOiBbXG4gICAgICAgICAgeyBsb2FkZXI6IFJhd0Nzc0xvYWRlciB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGxvYWRlcjogJ3Bvc3Rjc3MtbG9hZGVyJyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgaWRlbnQ6IGJ1aWxkT3B0aW9ucy5leHRyYWN0Q3NzID8gJ2V4dHJhY3RlZCcgOiAnZW1iZWRkZWQnLFxuICAgICAgICAgICAgICBwbHVnaW5zOiBwb3N0Y3NzUGx1Z2luQ3JlYXRvcixcbiAgICAgICAgICAgICAgc291cmNlTWFwOiBjc3NTb3VyY2VNYXBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIC4uLih1c2UgYXMgd2VicGFjay5Mb2FkZXJbXSlcbiAgICAgICAgXSxcbiAgICAgICAgLy8gcHVibGljUGF0aCBuZWVkZWQgYXMgYSB3b3JrYXJvdW5kIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy80MDM1XG4gICAgICAgIHB1YmxpY1BhdGg6ICcnXG4gICAgICB9O1xuICAgICAgY29uc3QgcmV0OiBhbnkgPSB7XG4gICAgICAgIGluY2x1ZGU6IGdsb2JhbFN0eWxlUGF0aHMsXG4gICAgICAgIHRlc3QsXG4gICAgICAgIHVzZTogW1xuICAgICAgICAgIGJ1aWxkT3B0aW9ucy5leHRyYWN0Q3NzID8gTWluaUNzc0V4dHJhY3RQbHVnaW4ubG9hZGVyIDogJ3N0eWxlLWxvYWRlcicsXG4gICAgICAgICAgLi4uZXh0cmFjdFRleHRQbHVnaW4udXNlLFxuICAgICAgICBdXG4gICAgICB9O1xuICAgICAgLy8gU2F2ZSB0aGUgb3JpZ2luYWwgb3B0aW9ucyBhcyBhcmd1bWVudHMgZm9yIGVqZWN0LlxuICAgICAgLy8gaWYgKGJ1aWxkT3B0aW9ucy5leHRyYWN0Q3NzKSB7XG4gICAgICAvLyAgIHJldFtwbHVnaW5BcmdzXSA9IGV4dHJhY3RUZXh0UGx1Z2luO1xuICAgICAgLy8gfVxuICAgICAgcmV0dXJuIHJldDtcbiAgICB9KSk7XG4gIH1cblxuICBpZiAoYnVpbGRPcHRpb25zLmV4dHJhY3RDc3MpIHtcbiAgICAvLyBleHRyYWN0IGdsb2JhbCBjc3MgZnJvbSBqcyBmaWxlcyBpbnRvIG93biBjc3MgZmlsZVxuICAgIGV4dHJhUGx1Z2lucy5wdXNoKFxuICAgICAgbmV3IE1pbmlDc3NFeHRyYWN0UGx1Z2luKHsgZmlsZW5hbWU6IGBbbmFtZV0ke2hhc2hGb3JtYXQuc2NyaXB0fS5jc3NgIH0pKTtcbiAgICAvLyBzdXBwcmVzcyBlbXB0eSAuanMgZmlsZXMgaW4gY3NzIG9ubHkgZW50cnkgcG9pbnRzXG4gICAgZXh0cmFQbHVnaW5zLnB1c2gobmV3IFN1cHByZXNzRXh0cmFjdGVkVGV4dENodW5rc1dlYnBhY2tQbHVnaW4oKSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC8vIFdvcmthcm91bmQgc3R5bHVzLWxvYWRlciBkZWZlY3Q6IGh0dHBzOi8vZ2l0aHViLmNvbS9zaGFtYS9zdHlsdXMtbG9hZGVyL2lzc3Vlcy8xODlcbiAgICBsb2FkZXI6IHsgc3R5bHVzOiB7fSB9LFxuICAgIGVudHJ5OiBlbnRyeVBvaW50cyxcbiAgICBtb2R1bGU6IHsgcnVsZXMgfSxcbiAgICBwbHVnaW5zOiBbXS5jb25jYXQoZXh0cmFQbHVnaW5zIGFzIGFueSlcbiAgfTtcbn1cbiJdfQ==