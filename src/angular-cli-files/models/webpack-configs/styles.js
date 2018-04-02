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
            const resolvedPath = path.resolve(root, style.input);
            // Add style entry points.
            if (entryPoints[style.bundleName]) {
                entryPoints[style.bundleName].push(resolvedPath);
            }
            else {
                entryPoints[style.bundleName] = [resolvedPath];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVzLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3N0eWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFHL0QsNkJBQTZCO0FBQzdCLG1EQUFpRjtBQUNqRixtQ0FBOEM7QUFFOUMscURBQWlEO0FBQ2pELG1EQUFxRDtBQUdyRCxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDMUMsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQzdDLE1BQU0sb0JBQW9CLEdBQUcsT0FBTyxDQUFDLHlCQUF5QixDQUFDLENBQUM7QUFDaEUsTUFBTSxjQUFjLEdBQUcsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUM7QUFDakQsTUFBTSxtQkFBbUIsR0FBRyxPQUFPLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQztBQXdCakYseUJBQWdDLEdBQXlCO0lBQ3ZELE1BQU0sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUVoRCw2REFBNkQ7SUFDN0QsTUFBTSxXQUFXLEdBQWdDLEVBQUUsQ0FBQztJQUNwRCxNQUFNLGdCQUFnQixHQUFhLEVBQUUsQ0FBQztJQUN0QyxNQUFNLFlBQVksR0FBVSxFQUFFLENBQUM7SUFDL0IsTUFBTSxZQUFZLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQztJQUU1Qyx3Q0FBd0M7SUFDeEMsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUM7SUFDN0IsNEJBQTRCO0lBQzVCLE1BQU0sVUFBVSxHQUFHLDJCQUFtQixDQUFDLFlBQVksQ0FBQyxhQUF1QixDQUFDLENBQUM7SUFDN0UsMEVBQTBFO0lBQzFFLE1BQU0sUUFB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VSxDQUFDLE1BQU0sTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVFLG9EQUFvRDtRQUNwRCxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksa0RBQXdDLEVBQUUsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFRCxNQUFNLENBQUM7UUFDTCxxRkFBcUY7UUFDckYsTUFBTSxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRTtRQUN0QixLQUFLLEVBQUUsV0FBVztRQUNsQixNQUFNLEVBQUUsRUFBRSxLQUFLLEVBQUU7UUFDakIsT0FBTyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsWUFBbUIsQ0FBQztLQUN4QyxDQUFDO0FBQ0osQ0FBQztBQXJQRCwwQ0FxUEMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyB0c2xpbnQ6ZGlzYWJsZVxuLy8gVE9ETzogY2xlYW51cCB0aGlzIGZpbGUsIGl0J3MgY29waWVkIGFzIGlzIGZyb20gQW5ndWxhciBDTEkuXG5cbmltcG9ydCAqIGFzIHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgU3VwcHJlc3NFeHRyYWN0ZWRUZXh0Q2h1bmtzV2VicGFja1BsdWdpbiB9IGZyb20gJy4uLy4uL3BsdWdpbnMvd2VicGFjayc7XG5pbXBvcnQgeyBnZXRPdXRwdXRIYXNoRm9ybWF0IH0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQgeyBXZWJwYWNrQ29uZmlnT3B0aW9ucyB9IGZyb20gJy4uL2J1aWxkLW9wdGlvbnMnO1xuaW1wb3J0IHsgZmluZFVwIH0gZnJvbSAnLi4vLi4vdXRpbGl0aWVzL2ZpbmQtdXAnO1xuaW1wb3J0IHsgUmF3Q3NzTG9hZGVyIH0gZnJvbSAnLi4vLi4vcGx1Z2lucy93ZWJwYWNrJztcbmltcG9ydCB7IEV4dHJhRW50cnlQb2ludCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXInO1xuXG5jb25zdCBwb3N0Y3NzVXJsID0gcmVxdWlyZSgncG9zdGNzcy11cmwnKTtcbmNvbnN0IGF1dG9wcmVmaXhlciA9IHJlcXVpcmUoJ2F1dG9wcmVmaXhlcicpO1xuY29uc3QgTWluaUNzc0V4dHJhY3RQbHVnaW4gPSByZXF1aXJlKCdtaW5pLWNzcy1leHRyYWN0LXBsdWdpbicpO1xuY29uc3QgcG9zdGNzc0ltcG9ydHMgPSByZXF1aXJlKCdwb3N0Y3NzLWltcG9ydCcpO1xuY29uc3QgUG9zdGNzc0NsaVJlc291cmNlcyA9IHJlcXVpcmUoJy4uLy4uL3BsdWdpbnMvd2VicGFjaycpLlBvc3Rjc3NDbGlSZXNvdXJjZXM7XG5cbi8qKlxuICogRW51bWVyYXRlIGxvYWRlcnMgYW5kIHRoZWlyIGRlcGVuZGVuY2llcyBmcm9tIHRoaXMgZmlsZSB0byBsZXQgdGhlIGRlcGVuZGVuY3kgdmFsaWRhdG9yXG4gKiBrbm93IHRoZXkgYXJlIHVzZWQuXG4gKlxuICogcmVxdWlyZSgnZXhwb3J0cy1sb2FkZXInKVxuICogcmVxdWlyZSgnc3R5bGUtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ3Bvc3Rjc3MtbG9hZGVyJylcbiAqIHJlcXVpcmUoJ2Nzcy1sb2FkZXInKVxuICogcmVxdWlyZSgnc3R5bHVzJylcbiAqIHJlcXVpcmUoJ3N0eWx1cy1sb2FkZXInKVxuICogcmVxdWlyZSgnbGVzcycpXG4gKiByZXF1aXJlKCdsZXNzLWxvYWRlcicpXG4gKiByZXF1aXJlKCdub2RlLXNhc3MnKVxuICogcmVxdWlyZSgnc2Fzcy1sb2FkZXInKVxuICovXG5cbmludGVyZmFjZSBQb3N0Y3NzVXJsQXNzZXQge1xuICB1cmw6IHN0cmluZztcbiAgaGFzaDogc3RyaW5nO1xuICBhYnNvbHV0ZVBhdGg6IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN0eWxlc0NvbmZpZyh3Y286IFdlYnBhY2tDb25maWdPcHRpb25zKSB7XG4gIGNvbnN0IHsgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkT3B0aW9ucyB9ID0gd2NvO1xuXG4gIC8vIGNvbnN0IGFwcFJvb3QgPSBwYXRoLnJlc29sdmUocHJvamVjdFJvb3QsIGFwcENvbmZpZy5yb290KTtcbiAgY29uc3QgZW50cnlQb2ludHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nW10gfSA9IHt9O1xuICBjb25zdCBnbG9iYWxTdHlsZVBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBleHRyYVBsdWdpbnM6IGFueVtdID0gW107XG4gIGNvbnN0IGNzc1NvdXJjZU1hcCA9IGJ1aWxkT3B0aW9ucy5zb3VyY2VNYXA7XG5cbiAgLy8gTWF4aW11bSByZXNvdXJjZSBzaXplIHRvIGlubGluZSAoS2lCKVxuICBjb25zdCBtYXhpbXVtSW5saW5lU2l6ZSA9IDEwO1xuICAvLyBEZXRlcm1pbmUgaGFzaGluZyBmb3JtYXQuXG4gIGNvbnN0IGhhc2hGb3JtYXQgPSBnZXRPdXRwdXRIYXNoRm9ybWF0KGJ1aWxkT3B0aW9ucy5vdXRwdXRIYXNoaW5nIGFzIHN0cmluZyk7XG4gIC8vIENvbnZlcnQgYWJzb2x1dGUgcmVzb3VyY2UgVVJMcyB0byBhY2NvdW50IGZvciBiYXNlLWhyZWYgYW5kIGRlcGxveS11cmwuXG4gIGNvbnN0IGJhc2VIcmVmID0gd2NvLmJ1aWxkT3B0aW9ucy5iYXNlSHJlZiB8fCAnJztcbiAgY29uc3QgZGVwbG95VXJsID0gd2NvLmJ1aWxkT3B0aW9ucy5kZXBsb3lVcmwgfHwgJyc7XG5cbiAgY29uc3QgcG9zdGNzc1BsdWdpbkNyZWF0b3IgPSBmdW5jdGlvbiAobG9hZGVyOiB3ZWJwYWNrLmxvYWRlci5Mb2FkZXJDb250ZXh0KSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIHBvc3Rjc3NJbXBvcnRzKHtcbiAgICAgICAgcmVzb2x2ZTogKHVybDogc3RyaW5nLCBjb250ZXh0OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBsZXQgaGFkVGlsZGUgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmICh1cmwgJiYgdXJsLnN0YXJ0c1dpdGgoJ34nKSkge1xuICAgICAgICAgICAgICB1cmwgPSB1cmwuc3Vic3RyKDEpO1xuICAgICAgICAgICAgICBoYWRUaWxkZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsb2FkZXIucmVzb2x2ZShjb250ZXh0LCAoaGFkVGlsZGUgPyAnJyA6ICcuLycpICsgdXJsLCAoZXJyOiBFcnJvciwgcmVzdWx0OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChoYWRUaWxkZSkge1xuICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxvYWRlci5yZXNvbHZlKGNvbnRleHQsIHVybCwgKGVycjogRXJyb3IsIHJlc3VsdDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGxvYWQ6IChmaWxlbmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgbG9hZGVyLmZzLnJlYWRGaWxlKGZpbGVuYW1lLCAoZXJyOiBFcnJvciwgZGF0YTogQnVmZmVyKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgICAgICAgICByZXNvbHZlKGNvbnRlbnQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgcG9zdGNzc1VybCh7XG4gICAgICAgIGZpbHRlcjogKHsgdXJsIH06IFBvc3Rjc3NVcmxBc3NldCkgPT4gdXJsLnN0YXJ0c1dpdGgoJ34nKSxcbiAgICAgICAgdXJsOiAoeyB1cmwgfTogUG9zdGNzc1VybEFzc2V0KSA9PiB7XG4gICAgICAgICAgLy8gTm90ZTogVGhpcyB3aWxsIG9ubHkgZmluZCB0aGUgZmlyc3Qgbm9kZV9tb2R1bGVzIGZvbGRlci5cbiAgICAgICAgICBjb25zdCBub2RlTW9kdWxlcyA9IGZpbmRVcCgnbm9kZV9tb2R1bGVzJywgcHJvamVjdFJvb3QpO1xuICAgICAgICAgIGlmICghbm9kZU1vZHVsZXMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGxvY2F0ZSBub2RlX21vZHVsZXMgZGlyZWN0b3J5LicpXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKG5vZGVNb2R1bGVzLCB1cmwuc3Vic3RyKDEpKTtcbiAgICAgICAgICByZXR1cm4gcGF0aC5yZWxhdGl2ZShsb2FkZXIuY29udGV4dCwgZnVsbFBhdGgpLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICBwb3N0Y3NzVXJsKFtcbiAgICAgICAge1xuICAgICAgICAgIC8vIE9ubHkgY29udmVydCByb290IHJlbGF0aXZlIFVSTHMsIHdoaWNoIENTUy1Mb2FkZXIgd29uJ3QgcHJvY2VzcyBpbnRvIHJlcXVpcmUoKS5cbiAgICAgICAgICBmaWx0ZXI6ICh7IHVybCB9OiBQb3N0Y3NzVXJsQXNzZXQpID0+IHVybC5zdGFydHNXaXRoKCcvJykgJiYgIXVybC5zdGFydHNXaXRoKCcvLycpLFxuICAgICAgICAgIHVybDogKHsgdXJsIH06IFBvc3Rjc3NVcmxBc3NldCkgPT4ge1xuICAgICAgICAgICAgaWYgKGRlcGxveVVybC5tYXRjaCgvOlxcL1xcLy8pIHx8IGRlcGxveVVybC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgICAgICAgICAgLy8gSWYgZGVwbG95VXJsIGlzIGFic29sdXRlIG9yIHJvb3QgcmVsYXRpdmUsIGlnbm9yZSBiYXNlSHJlZiAmIHVzZSBkZXBsb3lVcmwgYXMgaXMuXG4gICAgICAgICAgICAgIHJldHVybiBgJHtkZXBsb3lVcmwucmVwbGFjZSgvXFwvJC8sICcnKX0ke3VybH1gO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChiYXNlSHJlZi5tYXRjaCgvOlxcL1xcLy8pKSB7XG4gICAgICAgICAgICAgIC8vIElmIGJhc2VIcmVmIGNvbnRhaW5zIGEgc2NoZW1lLCBpbmNsdWRlIGl0IGFzIGlzLlxuICAgICAgICAgICAgICByZXR1cm4gYmFzZUhyZWYucmVwbGFjZSgvXFwvJC8sICcnKSArXG4gICAgICAgICAgICAgICAgYC8ke2RlcGxveVVybH0vJHt1cmx9YC5yZXBsYWNlKC9cXC9cXC8rL2csICcvJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBKb2luIHRvZ2V0aGVyIGJhc2UtaHJlZiwgZGVwbG95LXVybCBhbmQgdGhlIG9yaWdpbmFsIFVSTC5cbiAgICAgICAgICAgICAgLy8gQWxzbyBkZWR1cGUgbXVsdGlwbGUgc2xhc2hlcyBpbnRvIHNpbmdsZSBvbmVzLlxuICAgICAgICAgICAgICByZXR1cm4gYC8ke2Jhc2VIcmVmfS8ke2RlcGxveVVybH0vJHt1cmx9YC5yZXBsYWNlKC9cXC9cXC8rL2csICcvJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgLy8gVE9ETzogaW5saW5lIC5jdXIgaWYgbm90IHN1cHBvcnRpbmcgSUUgKHVzZSBicm93c2Vyc2xpc3QgdG8gY2hlY2spXG4gICAgICAgICAgZmlsdGVyOiAoYXNzZXQ6IFBvc3Rjc3NVcmxBc3NldCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG1heGltdW1JbmxpbmVTaXplID4gMCAmJiAhYXNzZXQuaGFzaCAmJiAhYXNzZXQuYWJzb2x1dGVQYXRoLmVuZHNXaXRoKCcuY3VyJyk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICB1cmw6ICdpbmxpbmUnLFxuICAgICAgICAgIC8vIE5PVEU6IG1heFNpemUgaXMgaW4gS0JcbiAgICAgICAgICBtYXhTaXplOiBtYXhpbXVtSW5saW5lU2l6ZSxcbiAgICAgICAgICBmYWxsYmFjazogJ3JlYmFzZScsXG4gICAgICAgIH0sXG4gICAgICAgIHsgdXJsOiAncmViYXNlJyB9LFxuICAgICAgXSksXG4gICAgICBQb3N0Y3NzQ2xpUmVzb3VyY2VzKHtcbiAgICAgICAgZGVwbG95VXJsOiBsb2FkZXIubG9hZGVyc1tsb2FkZXIubG9hZGVySW5kZXhdLm9wdGlvbnMuaWRlbnQgPT0gJ2V4dHJhY3RlZCcgPyAnJyA6IGRlcGxveVVybCxcbiAgICAgICAgbG9hZGVyLFxuICAgICAgICBmaWxlbmFtZTogYFtuYW1lXSR7aGFzaEZvcm1hdC5maWxlfS5bZXh0XWAsXG4gICAgICB9KSxcbiAgICAgIGF1dG9wcmVmaXhlcih7IGdyaWQ6IHRydWUgfSksXG4gICAgXTtcbiAgfTtcblxuICAvLyB1c2UgaW5jbHVkZVBhdGhzIGZyb20gYXBwQ29uZmlnXG4gIGNvbnN0IGluY2x1ZGVQYXRoczogc3RyaW5nW10gPSBbXTtcbiAgbGV0IGxlc3NQYXRoT3B0aW9uczogeyBwYXRoczogc3RyaW5nW10gfSA9IHsgcGF0aHM6IFtdIH07XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnNcbiAgICAmJiBidWlsZE9wdGlvbnMuc3R5bGVQcmVwcm9jZXNzb3JPcHRpb25zLmluY2x1ZGVQYXRoc1xuICAgICYmIGJ1aWxkT3B0aW9ucy5zdHlsZVByZXByb2Nlc3Nvck9wdGlvbnMuaW5jbHVkZVBhdGhzLmxlbmd0aCA+IDBcbiAgKSB7XG4gICAgYnVpbGRPcHRpb25zLnN0eWxlUHJlcHJvY2Vzc29yT3B0aW9ucy5pbmNsdWRlUGF0aHMuZm9yRWFjaCgoaW5jbHVkZVBhdGg6IHN0cmluZykgPT5cbiAgICAgIGluY2x1ZGVQYXRocy5wdXNoKHBhdGgucmVzb2x2ZShyb290LCBpbmNsdWRlUGF0aCkpKTtcbiAgICBsZXNzUGF0aE9wdGlvbnMgPSB7XG4gICAgICBwYXRoczogaW5jbHVkZVBhdGhzLFxuICAgIH07XG4gIH1cblxuICAvLyBQcm9jZXNzIGdsb2JhbCBzdHlsZXMuXG4gIGlmIChidWlsZE9wdGlvbnMuc3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICAoYnVpbGRPcHRpb25zLnN0eWxlcyBhcyBFeHRyYUVudHJ5UG9pbnRbXSkuZm9yRWFjaChzdHlsZSA9PiB7XG5cbiAgICAgIGNvbnN0IHJlc29sdmVkUGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBzdHlsZS5pbnB1dCk7XG5cbiAgICAgIC8vIEFkZCBzdHlsZSBlbnRyeSBwb2ludHMuXG4gICAgICBpZiAoZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0pIHtcbiAgICAgICAgZW50cnlQb2ludHNbc3R5bGUuYnVuZGxlTmFtZV0ucHVzaChyZXNvbHZlZFBhdGgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnRyeVBvaW50c1tzdHlsZS5idW5kbGVOYW1lXSA9IFtyZXNvbHZlZFBhdGhdXG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCBnbG9iYWwgY3NzIHBhdGhzLlxuICAgICAgZ2xvYmFsU3R5bGVQYXRocy5wdXNoKHJlc29sdmVkUGF0aCk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBzZXQgYmFzZSBydWxlcyB0byBkZXJpdmUgZmluYWwgcnVsZXMgZnJvbVxuICBjb25zdCBiYXNlUnVsZXM6IHdlYnBhY2suTmV3VXNlUnVsZVtdID0gW1xuICAgIHsgdGVzdDogL1xcLmNzcyQvLCB1c2U6IFtdIH0sXG4gICAge1xuICAgICAgdGVzdDogL1xcLnNjc3MkfFxcLnNhc3MkLywgdXNlOiBbe1xuICAgICAgICBsb2FkZXI6ICdzYXNzLWxvYWRlcicsXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICAvLyBib290c3RyYXAtc2FzcyByZXF1aXJlcyBhIG1pbmltdW0gcHJlY2lzaW9uIG9mIDhcbiAgICAgICAgICBwcmVjaXNpb246IDgsXG4gICAgICAgICAgaW5jbHVkZVBhdGhzXG4gICAgICAgIH1cbiAgICAgIH1dXG4gICAgfSxcbiAgICB7XG4gICAgICB0ZXN0OiAvXFwubGVzcyQvLCB1c2U6IFt7XG4gICAgICAgIGxvYWRlcjogJ2xlc3MtbG9hZGVyJyxcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwLFxuICAgICAgICAgIC4uLmxlc3NQYXRoT3B0aW9ucyxcbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9LFxuICAgIHtcbiAgICAgIHRlc3Q6IC9cXC5zdHlsJC8sIHVzZTogW3tcbiAgICAgICAgbG9hZGVyOiAnc3R5bHVzLWxvYWRlcicsXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcCxcbiAgICAgICAgICBwYXRoczogaW5jbHVkZVBhdGhzXG4gICAgICAgIH1cbiAgICAgIH1dXG4gICAgfVxuICBdO1xuXG4gIC8vIGxvYWQgY29tcG9uZW50IGNzcyBhcyByYXcgc3RyaW5nc1xuICBjb25zdCBydWxlczogd2VicGFjay5SdWxlW10gPSBiYXNlUnVsZXMubWFwKCh7IHRlc3QsIHVzZSB9KSA9PiAoe1xuICAgIGV4Y2x1ZGU6IGdsb2JhbFN0eWxlUGF0aHMsIHRlc3QsIHVzZTogW1xuICAgICAgeyBsb2FkZXI6ICdyYXctbG9hZGVyJyB9LFxuICAgICAge1xuICAgICAgICBsb2FkZXI6ICdwb3N0Y3NzLWxvYWRlcicsXG4gICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICBpZGVudDogJ2VtYmVkZGVkJyxcbiAgICAgICAgICBwbHVnaW5zOiBwb3N0Y3NzUGx1Z2luQ3JlYXRvcixcbiAgICAgICAgICBzb3VyY2VNYXA6IGNzc1NvdXJjZU1hcFxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgLi4uKHVzZSBhcyB3ZWJwYWNrLkxvYWRlcltdKVxuICAgIF1cbiAgfSkpO1xuXG4gIC8vIGxvYWQgZ2xvYmFsIGNzcyBhcyBjc3MgZmlsZXNcbiAgaWYgKGdsb2JhbFN0eWxlUGF0aHMubGVuZ3RoID4gMCkge1xuICAgIHJ1bGVzLnB1c2goLi4uYmFzZVJ1bGVzLm1hcCgoeyB0ZXN0LCB1c2UgfSkgPT4ge1xuICAgICAgY29uc3QgZXh0cmFjdFRleHRQbHVnaW4gPSB7XG4gICAgICAgIHVzZTogW1xuICAgICAgICAgIHsgbG9hZGVyOiBSYXdDc3NMb2FkZXIgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBsb2FkZXI6ICdwb3N0Y3NzLWxvYWRlcicsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGlkZW50OiBidWlsZE9wdGlvbnMuZXh0cmFjdENzcyA/ICdleHRyYWN0ZWQnIDogJ2VtYmVkZGVkJyxcbiAgICAgICAgICAgICAgcGx1Z2luczogcG9zdGNzc1BsdWdpbkNyZWF0b3IsXG4gICAgICAgICAgICAgIHNvdXJjZU1hcDogY3NzU291cmNlTWFwXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICAuLi4odXNlIGFzIHdlYnBhY2suTG9hZGVyW10pXG4gICAgICAgIF0sXG4gICAgICAgIC8vIHB1YmxpY1BhdGggbmVlZGVkIGFzIGEgd29ya2Fyb3VuZCBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9pc3N1ZXMvNDAzNVxuICAgICAgICBwdWJsaWNQYXRoOiAnJ1xuICAgICAgfTtcbiAgICAgIGNvbnN0IHJldDogYW55ID0ge1xuICAgICAgICBpbmNsdWRlOiBnbG9iYWxTdHlsZVBhdGhzLFxuICAgICAgICB0ZXN0LFxuICAgICAgICB1c2U6IFtcbiAgICAgICAgICBidWlsZE9wdGlvbnMuZXh0cmFjdENzcyA/IE1pbmlDc3NFeHRyYWN0UGx1Z2luLmxvYWRlciA6ICdzdHlsZS1sb2FkZXInLFxuICAgICAgICAgIC4uLmV4dHJhY3RUZXh0UGx1Z2luLnVzZSxcbiAgICAgICAgXVxuICAgICAgfTtcbiAgICAgIC8vIFNhdmUgdGhlIG9yaWdpbmFsIG9wdGlvbnMgYXMgYXJndW1lbnRzIGZvciBlamVjdC5cbiAgICAgIC8vIGlmIChidWlsZE9wdGlvbnMuZXh0cmFjdENzcykge1xuICAgICAgLy8gICByZXRbcGx1Z2luQXJnc10gPSBleHRyYWN0VGV4dFBsdWdpbjtcbiAgICAgIC8vIH1cbiAgICAgIHJldHVybiByZXQ7XG4gICAgfSkpO1xuICB9XG5cbiAgaWYgKGJ1aWxkT3B0aW9ucy5leHRyYWN0Q3NzKSB7XG4gICAgLy8gZXh0cmFjdCBnbG9iYWwgY3NzIGZyb20ganMgZmlsZXMgaW50byBvd24gY3NzIGZpbGVcbiAgICBleHRyYVBsdWdpbnMucHVzaChcbiAgICAgIG5ldyBNaW5pQ3NzRXh0cmFjdFBsdWdpbih7IGZpbGVuYW1lOiBgW25hbWVdJHtoYXNoRm9ybWF0LnNjcmlwdH0uY3NzYCB9KSk7XG4gICAgLy8gc3VwcHJlc3MgZW1wdHkgLmpzIGZpbGVzIGluIGNzcyBvbmx5IGVudHJ5IHBvaW50c1xuICAgIGV4dHJhUGx1Z2lucy5wdXNoKG5ldyBTdXBwcmVzc0V4dHJhY3RlZFRleHRDaHVua3NXZWJwYWNrUGx1Z2luKCkpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICAvLyBXb3JrYXJvdW5kIHN0eWx1cy1sb2FkZXIgZGVmZWN0OiBodHRwczovL2dpdGh1Yi5jb20vc2hhbWEvc3R5bHVzLWxvYWRlci9pc3N1ZXMvMTg5XG4gICAgbG9hZGVyOiB7IHN0eWx1czoge30gfSxcbiAgICBlbnRyeTogZW50cnlQb2ludHMsXG4gICAgbW9kdWxlOiB7IHJ1bGVzIH0sXG4gICAgcGx1Z2luczogW10uY29uY2F0KGV4dHJhUGx1Z2lucyBhcyBhbnkpXG4gIH07XG59XG4iXX0=