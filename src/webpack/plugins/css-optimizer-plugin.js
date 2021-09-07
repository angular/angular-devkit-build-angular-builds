"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CssOptimizerPlugin = void 0;
const esbuild_1 = require("esbuild");
const webpack_diagnostics_1 = require("../../utils/webpack-diagnostics");
/**
 * The name of the plugin provided to Webpack when tapping Webpack compiler hooks.
 */
const PLUGIN_NAME = 'angular-css-optimizer';
/**
 * A Webpack plugin that provides CSS optimization capabilities.
 *
 * The plugin uses both `esbuild` to provide both fast and highly-optimized
 * code output.
 */
class CssOptimizerPlugin {
    constructor(options) {
        if (options === null || options === void 0 ? void 0 : options.supportedBrowsers) {
            this.targets = this.transformSupportedBrowsersToTargets(options.supportedBrowsers);
        }
    }
    apply(compiler) {
        const { OriginalSource, SourceMapSource } = compiler.webpack.sources;
        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
            compilation.hooks.processAssets.tapPromise({
                name: PLUGIN_NAME,
                stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
            }, async (compilationAssets) => {
                const cache = compilation.options.cache && compilation.getCache(PLUGIN_NAME);
                for (const assetName of Object.keys(compilationAssets)) {
                    if (!/\.(?:css|scss|sass|less|styl)$/.test(assetName)) {
                        continue;
                    }
                    const asset = compilation.getAsset(assetName);
                    // Skip assets that have already been optimized or are verbatim copies (project assets)
                    if (!asset || asset.info.minimized || asset.info.copied) {
                        continue;
                    }
                    const { source: styleAssetSource, name } = asset;
                    let cacheItem;
                    if (cache) {
                        const eTag = cache.getLazyHashedEtag(styleAssetSource);
                        cacheItem = cache.getItemCache(name, eTag);
                        const cachedOutput = await cacheItem.getPromise();
                        if (cachedOutput) {
                            await this.addWarnings(compilation, cachedOutput.warnings);
                            compilation.updateAsset(name, cachedOutput.source, {
                                minimized: true,
                            });
                            continue;
                        }
                    }
                    const { source, map: inputMap } = styleAssetSource.sourceAndMap();
                    let sourceMapLine;
                    if (inputMap) {
                        // esbuild will automatically remap the sourcemap if provided
                        sourceMapLine = `\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(inputMap)).toString('base64')} */`;
                    }
                    const input = typeof source === 'string' ? source : source.toString();
                    const { code, warnings, map } = await esbuild_1.transform(sourceMapLine ? input + sourceMapLine : input, {
                        loader: 'css',
                        legalComments: 'inline',
                        minify: true,
                        sourcemap: !!inputMap && 'external',
                        sourcefile: asset.name,
                        target: this.targets,
                    });
                    await this.addWarnings(compilation, warnings);
                    const optimizedAsset = map
                        ? new SourceMapSource(code, name, map)
                        : new OriginalSource(code, name);
                    compilation.updateAsset(name, optimizedAsset, { minimized: true });
                    await (cacheItem === null || cacheItem === void 0 ? void 0 : cacheItem.storePromise({
                        source: optimizedAsset,
                        warnings,
                    }));
                }
            });
        });
    }
    async addWarnings(compilation, warnings) {
        if (warnings.length > 0) {
            for (const warning of await esbuild_1.formatMessages(warnings, { kind: 'warning' })) {
                webpack_diagnostics_1.addWarning(compilation, warning);
            }
        }
    }
    transformSupportedBrowsersToTargets(supportedBrowsers) {
        const transformed = [];
        // https://esbuild.github.io/api/#target
        const esBuildSupportedBrowsers = new Set(['safari', 'firefox', 'edge', 'chrome', 'ios']);
        for (const browser of supportedBrowsers) {
            let [browserName, version] = browser.split(' ');
            // browserslist uses the name `ios_saf` for iOS Safari whereas esbuild uses `ios`
            if (browserName === 'ios_saf') {
                browserName = 'ios';
                // browserslist also uses ranges for iOS Safari versions but only the lowest is required
                // to perform minimum supported feature checks. esbuild also expects a single version.
                [version] = version.split('-');
            }
            if (esBuildSupportedBrowsers.has(browserName)) {
                if (browserName === 'safari' && version === 'TP') {
                    // esbuild only supports numeric versions so `TP` is converted to a high number (999) since
                    // a Technology Preview (TP) of Safari is assumed to support all currently known features.
                    version = '999';
                }
                transformed.push(browserName + version);
            }
        }
        return transformed.length ? transformed : undefined;
    }
}
exports.CssOptimizerPlugin = CssOptimizerPlugin;
