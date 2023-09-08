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
const webpack_diagnostics_1 = require("../../../utils/webpack-diagnostics");
const utils_1 = require("../../esbuild/utils");
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
    targets;
    esbuild = new esbuild_executor_1.EsbuildExecutor();
    constructor(options) {
        if (options?.supportedBrowsers) {
            this.targets = (0, utils_1.transformSupportedBrowsersToTargets)(options.supportedBrowsers);
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
                    if (!/\.(?:css|scss|sass|less)$/.test(assetName)) {
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
                    await cacheItem?.storePromise({
                        source: optimizedAsset,
                        warnings,
                    });
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
}
exports.CssOptimizerPlugin = CssOptimizerPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzLW9wdGltaXplci1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy90b29scy93ZWJwYWNrL3BsdWdpbnMvY3NzLW9wdGltaXplci1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBSUgsNEVBQWdFO0FBQ2hFLCtDQUEwRTtBQUMxRSx5REFBcUQ7QUFFckQ7O0dBRUc7QUFDSCxNQUFNLFdBQVcsR0FBRyx1QkFBdUIsQ0FBQztBQU01Qzs7Ozs7R0FLRztBQUNILE1BQWEsa0JBQWtCO0lBQ3JCLE9BQU8sQ0FBdUI7SUFDOUIsT0FBTyxHQUFHLElBQUksa0NBQWUsRUFBRSxDQUFDO0lBRXhDLFlBQVksT0FBbUM7UUFDN0MsSUFBSSxPQUFPLEVBQUUsaUJBQWlCLEVBQUU7WUFDOUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFBLDJDQUFtQyxFQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1NBQy9FO0lBQ0gsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFrQjtRQUN0QixNQUFNLEVBQUUsY0FBYyxFQUFFLGVBQWUsRUFBRSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1FBRXJFLFFBQVEsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTtZQUMxRCxNQUFNLE1BQU0sR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLGtDQUFrQyxDQUFDLENBQUM7WUFFekUsV0FBVyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUN4QztnQkFDRSxJQUFJLEVBQUUsV0FBVztnQkFDakIsS0FBSyxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLGtDQUFrQzthQUN2RSxFQUNELEtB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LEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRTtnQkFDdEYsSUFBQSxnQ0FBVSxFQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQzthQUNsQztTQUNGO0lBQ0gsQ0FBQztDQUNGO0FBcElELGdEQW9JQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2UsIFRyYW5zZm9ybVJlc3VsdCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHR5cGUgeyBDb21waWxhdGlvbiwgQ29tcGlsZXIsIHNvdXJjZXMgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IGFkZFdhcm5pbmcgfSBmcm9tICcuLi8uLi8uLi91dGlscy93ZWJwYWNrLWRpYWdub3N0aWNzJztcbmltcG9ydCB7IHRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzIH0gZnJvbSAnLi4vLi4vZXNidWlsZC91dGlscyc7XG5pbXBvcnQgeyBFc2J1aWxkRXhlY3V0b3IgfSBmcm9tICcuL2VzYnVpbGQtZXhlY3V0b3InO1xuXG4vKipcbiAqIFRoZSBuYW1lIG9mIHRoZSBwbHVnaW4gcHJvdmlkZWQgdG8gV2VicGFjayB3aGVuIHRhcHBpbmcgV2VicGFjayBjb21waWxlciBob29rcy5cbiAqL1xuY29uc3QgUExVR0lOX05BTUUgPSAnYW5ndWxhci1jc3Mtb3B0aW1pemVyJztcblxuZXhwb3J0IGludGVyZmFjZSBDc3NPcHRpbWl6ZXJQbHVnaW5PcHRpb25zIHtcbiAgc3VwcG9ydGVkQnJvd3NlcnM/OiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiBBIFdlYnBhY2sgcGx1Z2luIHRoYXQgcHJvdmlkZXMgQ1NTIG9wdGltaXphdGlvbiBjYXBhYmlsaXRpZXMuXG4gKlxuICogVGhlIHBsdWdpbiB1c2VzIGJvdGggYGVzYnVpbGRgIHRvIHByb3ZpZGUgYm90aCBmYXN0IGFuZCBoaWdobHktb3B0aW1pemVkXG4gKiBjb2RlIG91dHB1dC5cbiAqL1xuZXhwb3J0IGNsYXNzIENzc09wdGltaXplclBsdWdpbiB7XG4gIHByaXZhdGUgdGFyZ2V0czogc3RyaW5nW10gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgZXNidWlsZCA9IG5ldyBFc2J1aWxkRXhlY3V0b3IoKTtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zPzogQ3NzT3B0aW1pemVyUGx1Z2luT3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zPy5zdXBwb3J0ZWRCcm93c2Vycykge1xuICAgICAgdGhpcy50YXJnZXRzID0gdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMob3B0aW9ucy5zdXBwb3J0ZWRCcm93c2Vycyk7XG4gICAgfVxuICB9XG5cbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKSB7XG4gICAgY29uc3QgeyBPcmlnaW5hbFNvdXJjZSwgU291cmNlTWFwU291cmNlIH0gPSBjb21waWxlci53ZWJwYWNrLnNvdXJjZXM7XG5cbiAgICBjb21waWxlci5ob29rcy5jb21waWxhdGlvbi50YXAoUExVR0lOX05BTUUsIChjb21waWxhdGlvbikgPT4ge1xuICAgICAgY29uc3QgbG9nZ2VyID0gY29tcGlsYXRpb24uZ2V0TG9nZ2VyKCdidWlsZC1hbmd1bGFyLkNzc09wdGltaXplclBsdWdpbicpO1xuXG4gICAgICBjb21waWxhdGlvbi5ob29rcy5wcm9jZXNzQXNzZXRzLnRhcFByb21pc2UoXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBQTFVHSU5fTkFNRSxcbiAgICAgICAgICBzdGFnZTogY29tcGlsZXIud2VicGFjay5Db21waWxhdGlvbi5QUk9DRVNTX0FTU0VUU19TVEFHRV9PUFRJTUlaRV9TSVpFLFxuICAgICAgICB9LFxuICAgICAgICBhc3luYyAoY29tcGlsYXRpb25Bc3NldHMpID0+IHtcbiAgICAgICAgICBjb25zdCBjYWNoZSA9IGNvbXBpbGF0aW9uLm9wdGlvbnMuY2FjaGUgJiYgY29tcGlsYXRpb24uZ2V0Q2FjaGUoUExVR0lOX05BTUUpO1xuXG4gICAgICAgICAgbG9nZ2VyLnRpbWUoJ29wdGltaXplIGNzcyBhc3NldHMnKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IGFzc2V0TmFtZSBvZiBPYmplY3Qua2V5cyhjb21waWxhdGlvbkFzc2V0cykpIHtcbiAgICAgICAgICAgIGlmICghL1xcLig/OmNzc3xzY3NzfHNhc3N8bGVzcykkLy50ZXN0KGFzc2V0TmFtZSkpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gY29tcGlsYXRpb24uZ2V0QXNzZXQoYXNzZXROYW1lKTtcbiAgICAgICAgICAgIC8vIFNraXAgYXNzZXRzIHRoYXQgaGF2ZSBhbHJlYWR5IGJlZW4gb3B0aW1pemVkIG9yIGFyZSB2ZXJiYXRpbSBjb3BpZXMgKHByb2plY3QgYXNzZXRzKVxuICAgICAgICAgICAgaWYgKCFhc3NldCB8fCBhc3NldC5pbmZvLm1pbmltaXplZCB8fCBhc3NldC5pbmZvLmNvcGllZCkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgeyBzb3VyY2U6IHN0eWxlQXNzZXRTb3VyY2UsIG5hbWUgfSA9IGFzc2V0O1xuICAgICAgICAgICAgbGV0IGNhY2hlSXRlbTtcblxuICAgICAgICAgICAgaWYgKGNhY2hlKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGVUYWcgPSBjYWNoZS5nZXRMYXp5SGFzaGVkRXRhZyhzdHlsZUFzc2V0U291cmNlKTtcbiAgICAgICAgICAgICAgY2FjaGVJdGVtID0gY2FjaGUuZ2V0SXRlbUNhY2hlKG5hbWUsIGVUYWcpO1xuICAgICAgICAgICAgICBjb25zdCBjYWNoZWRPdXRwdXQgPSBhd2FpdCBjYWNoZUl0ZW0uZ2V0UHJvbWlzZTxcbiAgICAgICAgICAgICAgICB7IHNvdXJjZTogc291cmNlcy5Tb3VyY2U7IHdhcm5pbmdzOiBNZXNzYWdlW10gfSB8IHVuZGVmaW5lZFxuICAgICAgICAgICAgICA+KCk7XG5cbiAgICAgICAgICAgICAgaWYgKGNhY2hlZE91dHB1dCkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5kZWJ1ZyhgJHtuYW1lfSByZXN0b3JlZCBmcm9tIGNhY2hlYCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5hZGRXYXJuaW5ncyhjb21waWxhdGlvbiwgY2FjaGVkT3V0cHV0Lndhcm5pbmdzKTtcbiAgICAgICAgICAgICAgICBjb21waWxhdGlvbi51cGRhdGVBc3NldChuYW1lLCBjYWNoZWRPdXRwdXQuc291cmNlLCAoYXNzZXRJbmZvKSA9PiAoe1xuICAgICAgICAgICAgICAgICAgLi4uYXNzZXRJbmZvLFxuICAgICAgICAgICAgICAgICAgbWluaW1pemVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB7IHNvdXJjZSwgbWFwOiBpbnB1dE1hcCB9ID0gc3R5bGVBc3NldFNvdXJjZS5zb3VyY2VBbmRNYXAoKTtcbiAgICAgICAgICAgIGNvbnN0IGlucHV0ID0gdHlwZW9mIHNvdXJjZSA9PT0gJ3N0cmluZycgPyBzb3VyY2UgOiBzb3VyY2UudG9TdHJpbmcoKTtcblxuICAgICAgICAgICAgY29uc3Qgb3B0aW1pemVBc3NldExhYmVsID0gYG9wdGltaXplIGFzc2V0OiAke2Fzc2V0Lm5hbWV9YDtcbiAgICAgICAgICAgIGxvZ2dlci50aW1lKG9wdGltaXplQXNzZXRMYWJlbCk7XG4gICAgICAgICAgICBjb25zdCB7IGNvZGUsIHdhcm5pbmdzLCBtYXAgfSA9IGF3YWl0IHRoaXMub3B0aW1pemUoXG4gICAgICAgICAgICAgIGlucHV0LFxuICAgICAgICAgICAgICBhc3NldC5uYW1lLFxuICAgICAgICAgICAgICBpbnB1dE1hcCxcbiAgICAgICAgICAgICAgdGhpcy50YXJnZXRzLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGxvZ2dlci50aW1lRW5kKG9wdGltaXplQXNzZXRMYWJlbCk7XG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuYWRkV2FybmluZ3MoY29tcGlsYXRpb24sIHdhcm5pbmdzKTtcblxuICAgICAgICAgICAgY29uc3Qgb3B0aW1pemVkQXNzZXQgPSBtYXBcbiAgICAgICAgICAgICAgPyBuZXcgU291cmNlTWFwU291cmNlKGNvZGUsIG5hbWUsIG1hcClcbiAgICAgICAgICAgICAgOiBuZXcgT3JpZ2luYWxTb3VyY2UoY29kZSwgbmFtZSk7XG4gICAgICAgICAgICBjb21waWxhdGlvbi51cGRhdGVBc3NldChuYW1lLCBvcHRpbWl6ZWRBc3NldCwgKGFzc2V0SW5mbykgPT4gKHtcbiAgICAgICAgICAgICAgLi4uYXNzZXRJbmZvLFxuICAgICAgICAgICAgICBtaW5pbWl6ZWQ6IHRydWUsXG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIGF3YWl0IGNhY2hlSXRlbT8uc3RvcmVQcm9taXNlKHtcbiAgICAgICAgICAgICAgc291cmNlOiBvcHRpbWl6ZWRBc3NldCxcbiAgICAgICAgICAgICAgd2FybmluZ3MsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbG9nZ2VyLnRpbWVFbmQoJ29wdGltaXplIGNzcyBhc3NldHMnKTtcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogT3B0aW1pemVzIGEgQ1NTIGFzc2V0IHVzaW5nIGVzYnVpbGQuXG4gICAqXG4gICAqIEBwYXJhbSBpbnB1dCBUaGUgQ1NTIGFzc2V0IHNvdXJjZSBjb250ZW50IHRvIG9wdGltaXplLlxuICAgKiBAcGFyYW0gbmFtZSBUaGUgbmFtZSBvZiB0aGUgQ1NTIGFzc2V0LiBVc2VkIHRvIGdlbmVyYXRlIHNvdXJjZSBtYXBzLlxuICAgKiBAcGFyYW0gaW5wdXRNYXAgT3B0aW9uYWxseSBzcGVjaWZpZXMgdGhlIENTUyBhc3NldCdzIG9yaWdpbmFsIHNvdXJjZSBtYXAgdGhhdCB3aWxsXG4gICAqIGJlIG1lcmdlZCB3aXRoIHRoZSBpbnRlcm1lZGlhdGUgb3B0aW1pemVkIHNvdXJjZSBtYXAuXG4gICAqIEBwYXJhbSB0YXJnZXQgT3B0aW9uYWxseSBzcGVjaWZpZXMgdGhlIHRhcmdldCBicm93c2VycyBmb3IgdGhlIG91dHB1dCBjb2RlLlxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgcmVzb2x2aW5nIHRvIHRoZSBvcHRpbWl6ZWQgQ1NTLCBzb3VyY2UgbWFwLCBhbmQgYW55IHdhcm5pbmdzLlxuICAgKi9cbiAgcHJpdmF0ZSBvcHRpbWl6ZShcbiAgICBpbnB1dDogc3RyaW5nLFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBpbnB1dE1hcDogb2JqZWN0LFxuICAgIHRhcmdldDogc3RyaW5nW10gfCB1bmRlZmluZWQsXG4gICk6IFByb21pc2U8VHJhbnNmb3JtUmVzdWx0PiB7XG4gICAgbGV0IHNvdXJjZU1hcExpbmU7XG4gICAgaWYgKGlucHV0TWFwKSB7XG4gICAgICAvLyBlc2J1aWxkIHdpbGwgYXV0b21hdGljYWxseSByZW1hcCB0aGUgc291cmNlbWFwIGlmIHByb3ZpZGVkXG4gICAgICBzb3VyY2VNYXBMaW5lID0gYFxcbi8qIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04O2Jhc2U2NCwke0J1ZmZlci5mcm9tKFxuICAgICAgICBKU09OLnN0cmluZ2lmeShpbnB1dE1hcCksXG4gICAgICApLnRvU3RyaW5nKCdiYXNlNjQnKX0gKi9gO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmVzYnVpbGQudHJhbnNmb3JtKHNvdXJjZU1hcExpbmUgPyBpbnB1dCArIHNvdXJjZU1hcExpbmUgOiBpbnB1dCwge1xuICAgICAgbG9hZGVyOiAnY3NzJyxcbiAgICAgIGxlZ2FsQ29tbWVudHM6ICdpbmxpbmUnLFxuICAgICAgbWluaWZ5OiB0cnVlLFxuICAgICAgc291cmNlbWFwOiAhIWlucHV0TWFwICYmICdleHRlcm5hbCcsXG4gICAgICBzb3VyY2VmaWxlOiBuYW1lLFxuICAgICAgdGFyZ2V0LFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBhZGRXYXJuaW5ncyhjb21waWxhdGlvbjogQ29tcGlsYXRpb24sIHdhcm5pbmdzOiBNZXNzYWdlW10pIHtcbiAgICBpZiAod2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgZm9yIChjb25zdCB3YXJuaW5nIG9mIGF3YWl0IHRoaXMuZXNidWlsZC5mb3JtYXRNZXNzYWdlcyh3YXJuaW5ncywgeyBraW5kOiAnd2FybmluZycgfSkpIHtcbiAgICAgICAgYWRkV2FybmluZyhjb21waWxhdGlvbiwgd2FybmluZyk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=