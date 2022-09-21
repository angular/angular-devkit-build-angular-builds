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
const webpack_diagnostics_1 = require("../../utils/webpack-diagnostics");
const esbuild_executor_1 = require("./esbuild-executor");
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
        this.esbuild = new esbuild_executor_1.EsbuildExecutor();
        if (options === null || options === void 0 ? void 0 : options.supportedBrowsers) {
            this.targets = this.transformSupportedBrowsersToTargets(options.supportedBrowsers);
        }
    }
    apply(compiler) {
        const { OriginalSource, SourceMapSource } = compiler.webpack.sources;
        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
            const logger = compilation.getLogger('build-angular.CssOptimizerPlugin');
            compilation.hooks.processAssets.tapPromise({
                name: PLUGIN_NAME,
                stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
            }, async (compilationAssets) => {
                const cache = compilation.options.cache && compilation.getCache(PLUGIN_NAME);
                logger.time('optimize css assets');
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
                            logger.debug(`${name} restored from cache`);
                            await this.addWarnings(compilation, cachedOutput.warnings);
                            compilation.updateAsset(name, cachedOutput.source, (assetInfo) => ({
                                ...assetInfo,
                                minimized: true,
                            }));
                            continue;
                        }
                    }
                    const { source, map: inputMap } = styleAssetSource.sourceAndMap();
                    const input = typeof source === 'string' ? source : source.toString();
                    const optimizeAssetLabel = `optimize asset: ${asset.name}`;
                    logger.time(optimizeAssetLabel);
                    const { code, warnings, map } = await this.optimize(input, asset.name, inputMap, this.targets);
                    logger.timeEnd(optimizeAssetLabel);
                    await this.addWarnings(compilation, warnings);
                    const optimizedAsset = map
                        ? new SourceMapSource(code, name, map)
                        : new OriginalSource(code, name);
                    compilation.updateAsset(name, optimizedAsset, (assetInfo) => ({
                        ...assetInfo,
                        minimized: true,
                    }));
                    await (cacheItem === null || cacheItem === void 0 ? void 0 : cacheItem.storePromise({
                        source: optimizedAsset,
                        warnings,
                    }));
                }
                logger.timeEnd('optimize css assets');
            });
        });
    }
    /**
     * Optimizes a CSS asset using esbuild.
     *
     * @param input The CSS asset source content to optimize.
     * @param name The name of the CSS asset. Used to generate source maps.
     * @param inputMap Optionally specifies the CSS asset's original source map that will
     * be merged with the intermediate optimized source map.
     * @param target Optionally specifies the target browsers for the output code.
     * @returns A promise resolving to the optimized CSS, source map, and any warnings.
     */
    optimize(input, name, inputMap, target) {
        let sourceMapLine;
        if (inputMap) {
            // esbuild will automatically remap the sourcemap if provided
            sourceMapLine = `\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(inputMap)).toString('base64')} */`;
        }
        return this.esbuild.transform(sourceMapLine ? input + sourceMapLine : input, {
            loader: 'css',
            legalComments: 'inline',
            minify: true,
            sourcemap: !!inputMap && 'external',
            sourcefile: name,
            target,
        });
    }
    async addWarnings(compilation, warnings) {
        if (warnings.length > 0) {
            for (const warning of await this.esbuild.formatMessages(warnings, { kind: 'warning' })) {
                (0, webpack_diagnostics_1.addWarning)(compilation, warning);
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
            }
            // browserslist uses ranges `15.2-15.3` versions but only the lowest is required
            // to perform minimum supported feature checks. esbuild also expects a single version.
            [version] = version.split('-');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzLW9wdGltaXplci1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3BsdWdpbnMvY3NzLW9wdGltaXplci1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBSUgseUVBQTZEO0FBQzdELHlEQUFxRDtBQUVyRDs7R0FFRztBQUNILE1BQU0sV0FBVyxHQUFHLHVCQUF1QixDQUFDO0FBTTVDOzs7OztHQUtHO0FBQ0gsTUFBYSxrQkFBa0I7SUFJN0IsWUFBWSxPQUFtQztRQUZ2QyxZQUFPLEdBQUcsSUFBSSxrQ0FBZSxFQUFFLENBQUM7UUFHdEMsSUFBSSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsaUJBQWlCLEVBQUU7WUFDOUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsbUNBQW1DLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7U0FDcEY7SUFDSCxDQUFDO0lBRUQsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLE1BQU0sRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFFckUsUUFBUSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO1lBQzFELE1BQU0sTUFBTSxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsa0NBQWtDLENBQUMsQ0FBQztZQUV6RSxXQUFXLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQ3hDO2dCQUNFLElBQUksRUFBRSxXQUFXO2dCQUNqQixLQUFLLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsa0NBQWtDO2FBQ3ZFLEVBQ0QsS0FBSyxFQUFFLGlCQUFp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InNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2UsIFRyYW5zZm9ybVJlc3VsdCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHR5cGUgeyBDb21waWxhdGlvbiwgQ29tcGlsZXIsIHNvdXJjZXMgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IGFkZFdhcm5pbmcgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWRpYWdub3N0aWNzJztcbmltcG9ydCB7IEVzYnVpbGRFeGVjdXRvciB9IGZyb20gJy4vZXNidWlsZC1leGVjdXRvcic7XG5cbi8qKlxuICogVGhlIG5hbWUgb2YgdGhlIHBsdWdpbiBwcm92aWRlZCB0byBXZWJwYWNrIHdoZW4gdGFwcGluZyBXZWJwYWNrIGNvbXBpbGVyIGhvb2tzLlxuICovXG5jb25zdCBQTFVHSU5fTkFNRSA9ICdhbmd1bGFyLWNzcy1vcHRpbWl6ZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIENzc09wdGltaXplclBsdWdpbk9wdGlvbnMge1xuICBzdXBwb3J0ZWRCcm93c2Vycz86IHN0cmluZ1tdO1xufVxuXG4vKipcbiAqIEEgV2VicGFjayBwbHVnaW4gdGhhdCBwcm92aWRlcyBDU1Mgb3B0aW1pemF0aW9uIGNhcGFiaWxpdGllcy5cbiAqXG4gKiBUaGUgcGx1Z2luIHVzZXMgYm90aCBgZXNidWlsZGAgdG8gcHJvdmlkZSBib3RoIGZhc3QgYW5kIGhpZ2hseS1vcHRpbWl6ZWRcbiAqIGNvZGUgb3V0cHV0LlxuICovXG5leHBvcnQgY2xhc3MgQ3NzT3B0aW1pemVyUGx1Z2luIHtcbiAgcHJpdmF0ZSB0YXJnZXRzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBlc2J1aWxkID0gbmV3IEVzYnVpbGRFeGVjdXRvcigpO1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM/OiBDc3NPcHRpbWl6ZXJQbHVnaW5PcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnM/LnN1cHBvcnRlZEJyb3dzZXJzKSB7XG4gICAgICB0aGlzLnRhcmdldHMgPSB0aGlzLnRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzKG9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMpO1xuICAgIH1cbiAgfVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcikge1xuICAgIGNvbnN0IHsgT3JpZ2luYWxTb3VyY2UsIFNvdXJjZU1hcFNvdXJjZSB9ID0gY29tcGlsZXIud2VicGFjay5zb3VyY2VzO1xuXG4gICAgY29tcGlsZXIuaG9va3MuY29tcGlsYXRpb24udGFwKFBMVUdJTl9OQU1FLCAoY29tcGlsYXRpb24pID0+IHtcbiAgICAgIGNvbnN0IGxvZ2dlciA9IGNvbXBpbGF0aW9uLmdldExvZ2dlcignYnVpbGQtYW5ndWxhci5Dc3NPcHRpbWl6ZXJQbHVnaW4nKTtcblxuICAgICAgY29tcGlsYXRpb24uaG9va3MucHJvY2Vzc0Fzc2V0cy50YXBQcm9taXNlKFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogUExVR0lOX05BTUUsXG4gICAgICAgICAgc3RhZ2U6IGNvbXBpbGVyLndlYnBhY2suQ29tcGlsYXRpb24uUFJPQ0VTU19BU1NFVFNfU1RBR0VfT1BUSU1JWkVfU0laRSxcbiAgICAgICAgfSxcbiAgICAgICAgYXN5bmMgKGNvbXBpbGF0aW9uQXNzZXRzKSA9PiB7XG4gICAgICAgICAgY29uc3QgY2FjaGUgPSBjb21waWxhdGlvbi5vcHRpb25zLmNhY2hlICYmIGNvbXBpbGF0aW9uLmdldENhY2hlKFBMVUdJTl9OQU1FKTtcblxuICAgICAgICAgIGxvZ2dlci50aW1lKCdvcHRpbWl6ZSBjc3MgYXNzZXRzJyk7XG4gICAgICAgICAgZm9yIChjb25zdCBhc3NldE5hbWUgb2YgT2JqZWN0LmtleXMoY29tcGlsYXRpb25Bc3NldHMpKSB7XG4gICAgICAgICAgICBpZiAoIS9cXC4oPzpjc3N8c2Nzc3xzYXNzfGxlc3N8c3R5bCkkLy50ZXN0KGFzc2V0TmFtZSkpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gY29tcGlsYXRpb24uZ2V0QXNzZXQoYXNzZXROYW1lKTtcbiAgICAgICAgICAgIC8vIFNraXAgYXNzZXRzIHRoYXQgaGF2ZSBhbHJlYWR5IGJlZW4gb3B0aW1pemVkIG9yIGFyZSB2ZXJiYXRpbSBjb3BpZXMgKHByb2plY3QgYXNzZXRzKVxuICAgICAgICAgICAgaWYgKCFhc3NldCB8fCBhc3NldC5pbmZvLm1pbmltaXplZCB8fCBhc3NldC5pbmZvLmNvcGllZCkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgeyBzb3VyY2U6IHN0eWxlQXNzZXRTb3VyY2UsIG5hbWUgfSA9IGFzc2V0O1xuICAgICAgICAgICAgbGV0IGNhY2hlSXRlbTtcblxuICAgICAgICAgICAgaWYgKGNhY2hlKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGVUYWcgPSBjYWNoZS5nZXRMYXp5SGFzaGVkRXRhZyhzdHlsZUFzc2V0U291cmNlKTtcbiAgICAgICAgICAgICAgY2FjaGVJdGVtID0gY2FjaGUuZ2V0SXRlbUNhY2hlKG5hbWUsIGVUYWcpO1xuICAgICAgICAgICAgICBjb25zdCBjYWNoZWRPdXRwdXQgPSBhd2FpdCBjYWNoZUl0ZW0uZ2V0UHJvbWlzZTxcbiAgICAgICAgICAgICAgICB7IHNvdXJjZTogc291cmNlcy5Tb3VyY2U7IHdhcm5pbmdzOiBNZXNzYWdlW10gfSB8IHVuZGVmaW5lZFxuICAgICAgICAgICAgICA+KCk7XG5cbiAgICAgICAgICAgICAgaWYgKGNhY2hlZE91dHB1dCkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5kZWJ1ZyhgJHtuYW1lfSByZXN0b3JlZCBmcm9tIGNhY2hlYCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5hZGRXYXJuaW5ncyhjb21waWxhdGlvbiwgY2FjaGVkT3V0cHV0Lndhcm5pbmdzKTtcbiAgICAgICAgICAgICAgICBjb21waWxhdGlvbi51cGRhdGVBc3NldChuYW1lLCBjYWNoZWRPdXRwdXQuc291cmNlLCAoYXNzZXRJbmZvKSA9PiAoe1xuICAgICAgICAgICAgICAgICAgLi4uYXNzZXRJbmZvLFxuICAgICAgICAgICAgICAgICAgbWluaW1pemVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB7IHNvdXJjZSwgbWFwOiBpbnB1dE1hcCB9ID0gc3R5bGVBc3NldFNvdXJjZS5zb3VyY2VBbmRNYXAoKTtcbiAgICAgICAgICAgIGNvbnN0IGlucHV0ID0gdHlwZW9mIHNvdXJjZSA9PT0gJ3N0cmluZycgPyBzb3VyY2UgOiBzb3VyY2UudG9TdHJpbmcoKTtcblxuICAgICAgICAgICAgY29uc3Qgb3B0aW1pemVBc3NldExhYmVsID0gYG9wdGltaXplIGFzc2V0OiAke2Fzc2V0Lm5hbWV9YDtcbiAgICAgICAgICAgIGxvZ2dlci50aW1lKG9wdGltaXplQXNzZXRMYWJlbCk7XG4gICAgICAgICAgICBjb25zdCB7IGNvZGUsIHdhcm5pbmdzLCBtYXAgfSA9IGF3YWl0IHRoaXMub3B0aW1pemUoXG4gICAgICAgICAgICAgIGlucHV0LFxuICAgICAgICAgICAgICBhc3NldC5uYW1lLFxuICAgICAgICAgICAgICBpbnB1dE1hcCxcbiAgICAgICAgICAgICAgdGhpcy50YXJnZXRzLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGxvZ2dlci50aW1lRW5kKG9wdGltaXplQXNzZXRMYWJlbCk7XG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuYWRkV2FybmluZ3MoY29tcGlsYXRpb24sIHdhcm5pbmdzKTtcblxuICAgICAgICAgICAgY29uc3Qgb3B0aW1pemVkQXNzZXQgPSBtYXBcbiAgICAgICAgICAgICAgPyBuZXcgU291cmNlTWFwU291cmNlKGNvZGUsIG5hbWUsIG1hcClcbiAgICAgICAgICAgICAgOiBuZXcgT3JpZ2luYWxTb3VyY2UoY29kZSwgbmFtZSk7XG4gICAgICAgICAgICBjb21waWxhdGlvbi51cGRhdGVBc3NldChuYW1lLCBvcHRpbWl6ZWRBc3NldCwgKGFzc2V0SW5mbykgPT4gKHtcbiAgICAgICAgICAgICAgLi4uYXNzZXRJbmZvLFxuICAgICAgICAgICAgICBtaW5pbWl6ZWQ6IHRydWUsXG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIGF3YWl0IGNhY2hlSXRlbT8uc3RvcmVQcm9taXNlKHtcbiAgICAgICAgICAgICAgc291cmNlOiBvcHRpbWl6ZWRBc3NldCxcbiAgICAgICAgICAgICAgd2FybmluZ3MsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbG9nZ2VyLnRpbWVFbmQoJ29wdGltaXplIGNzcyBhc3NldHMnKTtcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogT3B0aW1pemVzIGEgQ1NTIGFzc2V0IHVzaW5nIGVzYnVpbGQuXG4gICAqXG4gICAqIEBwYXJhbSBpbnB1dCBUaGUgQ1NTIGFzc2V0IHNvdXJjZSBjb250ZW50IHRvIG9wdGltaXplLlxuICAgKiBAcGFyYW0gbmFtZSBUaGUgbmFtZSBvZiB0aGUgQ1NTIGFzc2V0LiBVc2VkIHRvIGdlbmVyYXRlIHNvdXJjZSBtYXBzLlxuICAgKiBAcGFyYW0gaW5wdXRNYXAgT3B0aW9uYWxseSBzcGVjaWZpZXMgdGhlIENTUyBhc3NldCdzIG9yaWdpbmFsIHNvdXJjZSBtYXAgdGhhdCB3aWxsXG4gICAqIGJlIG1lcmdlZCB3aXRoIHRoZSBpbnRlcm1lZGlhdGUgb3B0aW1pemVkIHNvdXJjZSBtYXAuXG4gICAqIEBwYXJhbSB0YXJnZXQgT3B0aW9uYWxseSBzcGVjaWZpZXMgdGhlIHRhcmdldCBicm93c2VycyBmb3IgdGhlIG91dHB1dCBjb2RlLlxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgcmVzb2x2aW5nIHRvIHRoZSBvcHRpbWl6ZWQgQ1NTLCBzb3VyY2UgbWFwLCBhbmQgYW55IHdhcm5pbmdzLlxuICAgKi9cbiAgcHJpdmF0ZSBvcHRpbWl6ZShcbiAgICBpbnB1dDogc3RyaW5nLFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBpbnB1dE1hcDogb2JqZWN0LFxuICAgIHRhcmdldDogc3RyaW5nW10gfCB1bmRlZmluZWQsXG4gICk6IFByb21pc2U8VHJhbnNmb3JtUmVzdWx0PiB7XG4gICAgbGV0IHNvdXJjZU1hcExpbmU7XG4gICAgaWYgKGlucHV0TWFwKSB7XG4gICAgICAvLyBlc2J1aWxkIHdpbGwgYXV0b21hdGljYWxseSByZW1hcCB0aGUgc291cmNlbWFwIGlmIHByb3ZpZGVkXG4gICAgICBzb3VyY2VNYXBMaW5lID0gYFxcbi8qIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04O2Jhc2U2NCwke0J1ZmZlci5mcm9tKFxuICAgICAgICBKU09OLnN0cmluZ2lmeShpbnB1dE1hcCksXG4gICAgICApLnRvU3RyaW5nKCdiYXNlNjQnKX0gKi9gO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmVzYnVpbGQudHJhbnNmb3JtKHNvdXJjZU1hcExpbmUgPyBpbnB1dCArIHNvdXJjZU1hcExpbmUgOiBpbnB1dCwge1xuICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgIGxlZ2FsQ29tbWVudHM6ICdpbmxpbmUnLFxuICAgICAgbWluaWZ5OiB0cnVlLFxuICAgICAgc291cmNlbWFwOiAhIWlucHV0TWFwICYmICdleHRlcm5hbCcsXG4gICAgICBzb3VyY2VmaWxlOiBuYW1lLFxuICAgICAgdGFyZ2V0LFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBhZGRXYXJuaW5ncyhjb21waWxhdGlvbjogQ29tcGlsYXRpb24sIHdhcm5pbmdzOiBNZXNzYWdlW10pIHtcbiAgICBpZiAod2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgZm9yIChjb25zdCB3YXJuaW5nIG9mIGF3YWl0IHRoaXMuZXNidWlsZC5mb3JtYXRNZXNzYWdlcyh3YXJuaW5ncywgeyBraW5kOiAnd2FybmluZycgfSkpIHtcbiAgICAgICAgYWRkV2FybmluZyhjb21waWxhdGlvbiwgd2FybmluZyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyhzdXBwb3J0ZWRCcm93c2Vyczogc3RyaW5nW10pOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgdHJhbnNmb3JtZWQ6IHN0cmluZ1tdID0gW107XG5cbiAgICAvLyBodHRwczovL2VzYnVpbGQuZ2l0aHViLmlvL2FwaS8jdGFyZ2V0XG4gICAgY29uc3QgZXNCdWlsZFN1cHBvcnRlZEJyb3dzZXJzID0gbmV3IFNldChbJ3NhZmFyaScsICdmaXJlZm94JywgJ2VkZ2UnLCAnY2hyb21lJywgJ2lvcyddKTtcblxuICAgIGZvciAoY29uc3QgYnJvd3NlciBvZiBzdXBwb3J0ZWRCcm93c2Vycykge1xuICAgICAgbGV0IFticm93c2VyTmFtZSwgdmVyc2lvbl0gPSBicm93c2VyLnNwbGl0KCcgJyk7XG5cbiAgICAgIC8vIGJyb3dzZXJzbGlzdCB1c2VzIHRoZSBuYW1lIGBpb3Nfc2FmYCBmb3IgaU9TIFNhZmFyaSB3aGVyZWFzIGVzYnVpbGQgdXNlcyBgaW9zYFxuICAgICAgaWYgKGJyb3dzZXJOYW1lID09PSAnaW9zX3NhZicpIHtcbiAgICAgICAgYnJvd3Nlck5hbWUgPSAnaW9zJztcbiAgICAgIH1cblxuICAgICAgLy8gYnJvd3NlcnNsaXN0IHVzZXMgcmFuZ2VzIGAxNS4yLTE1LjNgIHZlcnNpb25zIGJ1dCBvbmx5IHRoZSBsb3dlc3QgaXMgcmVxdWlyZWRcbiAgICAgIC8vIHRvIHBlcmZvcm0gbWluaW11bSBzdXBwb3J0ZWQgZmVhdHVyZSBjaGVja3MuIGVzYnVpbGQgYWxzbyBleHBlY3RzIGEgc2luZ2xlIHZlcnNpb24uXG4gICAgICBbdmVyc2lvbl0gPSB2ZXJzaW9uLnNwbGl0KCctJyk7XG5cbiAgICAgIGlmIChlc0J1aWxkU3VwcG9ydGVkQnJvd3NlcnMuaGFzKGJyb3dzZXJOYW1lKSkge1xuICAgICAgICBpZiAoYnJvd3Nlck5hbWUgPT09ICdzYWZhcmknICYmIHZlcnNpb24gPT09ICdUUCcpIHtcbiAgICAgICAgICAvLyBlc2J1aWxkIG9ubHkgc3VwcG9ydHMgbnVtZXJpYyB2ZXJzaW9ucyBzbyBgVFBgIGlzIGNvbnZlcnRlZCB0byBhIGhpZ2ggbnVtYmVyICg5OTkpIHNpbmNlXG4gICAgICAgICAgLy8gYSBUZWNobm9sb2d5IFByZXZpZXcgKFRQKSBvZiBTYWZhcmkgaXMgYXNzdW1lZCB0byBzdXBwb3J0IGFsbCBjdXJyZW50bHkga25vd24gZmVhdHVyZXMuXG4gICAgICAgICAgdmVyc2lvbiA9ICc5OTknO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJhbnNmb3JtZWQucHVzaChicm93c2VyTmFtZSArIHZlcnNpb24pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cmFuc2Zvcm1lZC5sZW5ndGggPyB0cmFuc2Zvcm1lZCA6IHVuZGVmaW5lZDtcbiAgfVxufVxuIl19