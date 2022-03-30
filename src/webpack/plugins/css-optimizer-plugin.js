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
                            compilation.updateAsset(name, cachedOutput.source, (assetInfo) => ({
                                ...assetInfo,
                                minimized: true,
                            }));
                            continue;
                        }
                    }
                    const { source, map: inputMap } = styleAssetSource.sourceAndMap();
                    const input = typeof source === 'string' ? source : source.toString();
                    const { code, warnings, map } = await this.optimize(input, asset.name, inputMap, this.targets);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzLW9wdGltaXplci1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3BsdWdpbnMvY3NzLW9wdGltaXplci1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBSUgseUVBQTZEO0FBQzdELHlEQUFxRDtBQUVyRDs7R0FFRztBQUNILE1BQU0sV0FBVyxHQUFHLHVCQUF1QixDQUFDO0FBTTVDOzs7OztHQUtHO0FBQ0gsTUFBYSxrQkFBa0I7SUFJN0IsWUFBWSxPQUFtQztRQUZ2QyxZQUFPLEdBQUcsSUFBSSxrQ0FBZSxFQUFFLENBQUM7UUFHdEMsSUFBSSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsaUJBQWlCLEVBQUU7WUFDOUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsbUNBQW1DLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7U0FDcEY7SUFDSCxDQUFDO0lBRUQsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLE1BQU0sRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFFckUsUUFBUSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO1lBQzFELFdBQVcsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FDeEM7Z0JBQ0UsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLEtBQUssRUFBRSxRQUFRLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxrQ0FBa0M7YUFDdkUsRUFDRCxLQUFLLEVBQUUsaUJBQWlCLEVBQUUsRUFBRTtnQkFDMUIsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxLQUFL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QUFJLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7WUFFaEQsaUZBQWlGO1lBQ2pGLElBQUksV0FBVyxLQUFLLFNBQVMsRUFBRTtnQkFDN0IsV0FBVyxHQUFHLEtBQUssQ0FBQzthQUNyQjtZQUVELGdGQUFnRjtZQUNoRixzRkFBc0Y7WUFDdEYsQ0FBQyxPQUFPLENBQUMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBRS9CLElBQUksd0JBQXdCLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUM3QyxJQUFJLFdBQVcsS0FBSyxRQUFRLElBQUksT0FBTyxLQUFLLElBQUksRUFBRTtvQkFDaEQsMkZBQTJGO29CQUMzRiwwRkFBMEY7b0JBQzFGLE9BQU8sR0FBRyxLQUFLLENBQUM7aUJBQ2pCO2dCQUVELFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxDQUFDO2FBQ3pDO1NBQ0Y7UUFFRCxPQUFPLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQ3RELENBQUM7Q0FDRjtBQTVKRCxnREE0SkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBNZXNzYWdlLCBUcmFuc2Zvcm1SZXN1bHQgfSBmcm9tICdlc2J1aWxkJztcbmltcG9ydCB0eXBlIHsgQ29tcGlsYXRpb24sIENvbXBpbGVyLCBzb3VyY2VzIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBhZGRXYXJuaW5nIH0gZnJvbSAnLi4vLi4vdXRpbHMvd2VicGFjay1kaWFnbm9zdGljcyc7XG5pbXBvcnQgeyBFc2J1aWxkRXhlY3V0b3IgfSBmcm9tICcuL2VzYnVpbGQtZXhlY3V0b3InO1xuXG4vKipcbiAqIFRoZSBuYW1lIG9mIHRoZSBwbHVnaW4gcHJvdmlkZWQgdG8gV2VicGFjayB3aGVuIHRhcHBpbmcgV2VicGFjayBjb21waWxlciBob29rcy5cbiAqL1xuY29uc3QgUExVR0lOX05BTUUgPSAnYW5ndWxhci1jc3Mtb3B0aW1pemVyJztcblxuZXhwb3J0IGludGVyZmFjZSBDc3NPcHRpbWl6ZXJQbHVnaW5PcHRpb25zIHtcbiAgc3VwcG9ydGVkQnJvd3NlcnM/OiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiBBIFdlYnBhY2sgcGx1Z2luIHRoYXQgcHJvdmlkZXMgQ1NTIG9wdGltaXphdGlvbiBjYXBhYmlsaXRpZXMuXG4gKlxuICogVGhlIHBsdWdpbiB1c2VzIGJvdGggYGVzYnVpbGRgIHRvIHByb3ZpZGUgYm90aCBmYXN0IGFuZCBoaWdobHktb3B0aW1pemVkXG4gKiBjb2RlIG91dHB1dC5cbiAqL1xuZXhwb3J0IGNsYXNzIENzc09wdGltaXplclBsdWdpbiB7XG4gIHByaXZhdGUgdGFyZ2V0czogc3RyaW5nW10gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgZXNidWlsZCA9IG5ldyBFc2J1aWxkRXhlY3V0b3IoKTtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zPzogQ3NzT3B0aW1pemVyUGx1Z2luT3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zPy5zdXBwb3J0ZWRCcm93c2Vycykge1xuICAgICAgdGhpcy50YXJnZXRzID0gdGhpcy50cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyhvcHRpb25zLnN1cHBvcnRlZEJyb3dzZXJzKTtcbiAgICB9XG4gIH1cblxuICBhcHBseShjb21waWxlcjogQ29tcGlsZXIpIHtcbiAgICBjb25zdCB7IE9yaWdpbmFsU291cmNlLCBTb3VyY2VNYXBTb3VyY2UgfSA9IGNvbXBpbGVyLndlYnBhY2suc291cmNlcztcblxuICAgIGNvbXBpbGVyLmhvb2tzLmNvbXBpbGF0aW9uLnRhcChQTFVHSU5fTkFNRSwgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICBjb21waWxhdGlvbi5ob29rcy5wcm9jZXNzQXNzZXRzLnRhcFByb21pc2UoXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBQTFVHSU5fTkFNRSxcbiAgICAgICAgICBzdGFnZTogY29tcGlsZXIud2VicGFjay5Db21waWxhdGlvbi5QUk9DRVNTX0FTU0VUU19TVEFHRV9PUFRJTUlaRV9TSVpFLFxuICAgICAgICB9LFxuICAgICAgICBhc3luYyAoY29tcGlsYXRpb25Bc3NldHMpID0+IHtcbiAgICAgICAgICBjb25zdCBjYWNoZSA9IGNvbXBpbGF0aW9uLm9wdGlvbnMuY2FjaGUgJiYgY29tcGlsYXRpb24uZ2V0Q2FjaGUoUExVR0lOX05BTUUpO1xuXG4gICAgICAgICAgZm9yIChjb25zdCBhc3NldE5hbWUgb2YgT2JqZWN0LmtleXMoY29tcGlsYXRpb25Bc3NldHMpKSB7XG4gICAgICAgICAgICBpZiAoIS9cXC4oPzpjc3N8c2Nzc3xzYXNzfGxlc3N8c3R5bCkkLy50ZXN0KGFzc2V0TmFtZSkpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gY29tcGlsYXRpb24uZ2V0QXNzZXQoYXNzZXROYW1lKTtcbiAgICAgICAgICAgIC8vIFNraXAgYXNzZXRzIHRoYXQgaGF2ZSBhbHJlYWR5IGJlZW4gb3B0aW1pemVkIG9yIGFyZSB2ZXJiYXRpbSBjb3BpZXMgKHByb2plY3QgYXNzZXRzKVxuICAgICAgICAgICAgaWYgKCFhc3NldCB8fCBhc3NldC5pbmZvLm1pbmltaXplZCB8fCBhc3NldC5pbmZvLmNvcGllZCkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgeyBzb3VyY2U6IHN0eWxlQXNzZXRTb3VyY2UsIG5hbWUgfSA9IGFzc2V0O1xuICAgICAgICAgICAgbGV0IGNhY2hlSXRlbTtcblxuICAgICAgICAgICAgaWYgKGNhY2hlKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGVUYWcgPSBjYWNoZS5nZXRMYXp5SGFzaGVkRXRhZyhzdHlsZUFzc2V0U291cmNlKTtcbiAgICAgICAgICAgICAgY2FjaGVJdGVtID0gY2FjaGUuZ2V0SXRlbUNhY2hlKG5hbWUsIGVUYWcpO1xuICAgICAgICAgICAgICBjb25zdCBjYWNoZWRPdXRwdXQgPSBhd2FpdCBjYWNoZUl0ZW0uZ2V0UHJvbWlzZTxcbiAgICAgICAgICAgICAgICB7IHNvdXJjZTogc291cmNlcy5Tb3VyY2U7IHdhcm5pbmdzOiBNZXNzYWdlW10gfSB8IHVuZGVmaW5lZFxuICAgICAgICAgICAgICA+KCk7XG5cbiAgICAgICAgICAgICAgaWYgKGNhY2hlZE91dHB1dCkge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYWRkV2FybmluZ3MoY29tcGlsYXRpb24sIGNhY2hlZE91dHB1dC53YXJuaW5ncyk7XG4gICAgICAgICAgICAgICAgY29tcGlsYXRpb24udXBkYXRlQXNzZXQobmFtZSwgY2FjaGVkT3V0cHV0LnNvdXJjZSwgKGFzc2V0SW5mbykgPT4gKHtcbiAgICAgICAgICAgICAgICAgIC4uLmFzc2V0SW5mbyxcbiAgICAgICAgICAgICAgICAgIG1pbmltaXplZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgeyBzb3VyY2UsIG1hcDogaW5wdXRNYXAgfSA9IHN0eWxlQXNzZXRTb3VyY2Uuc291cmNlQW5kTWFwKCk7XG4gICAgICAgICAgICBjb25zdCBpbnB1dCA9IHR5cGVvZiBzb3VyY2UgPT09ICdzdHJpbmcnID8gc291cmNlIDogc291cmNlLnRvU3RyaW5nKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IHsgY29kZSwgd2FybmluZ3MsIG1hcCB9ID0gYXdhaXQgdGhpcy5vcHRpbWl6ZShcbiAgICAgICAgICAgICAgaW5wdXQsXG4gICAgICAgICAgICAgIGFzc2V0Lm5hbWUsXG4gICAgICAgICAgICAgIGlucHV0TWFwLFxuICAgICAgICAgICAgICB0aGlzLnRhcmdldHMsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFkZFdhcm5pbmdzKGNvbXBpbGF0aW9uLCB3YXJuaW5ncyk7XG5cbiAgICAgICAgICAgIGNvbnN0IG9wdGltaXplZEFzc2V0ID0gbWFwXG4gICAgICAgICAgICAgID8gbmV3IFNvdXJjZU1hcFNvdXJjZShjb2RlLCBuYW1lLCBtYXApXG4gICAgICAgICAgICAgIDogbmV3IE9yaWdpbmFsU291cmNlKGNvZGUsIG5hbWUpO1xuICAgICAgICAgICAgY29tcGlsYXRpb24udXBkYXRlQXNzZXQobmFtZSwgb3B0aW1pemVkQXNzZXQsIChhc3NldEluZm8pID0+ICh7XG4gICAgICAgICAgICAgIC4uLmFzc2V0SW5mbyxcbiAgICAgICAgICAgICAgbWluaW1pemVkOiB0cnVlLFxuICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICBhd2FpdCBjYWNoZUl0ZW0/LnN0b3JlUHJvbWlzZSh7XG4gICAgICAgICAgICAgIHNvdXJjZTogb3B0aW1pemVkQXNzZXQsXG4gICAgICAgICAgICAgIHdhcm5pbmdzLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBPcHRpbWl6ZXMgYSBDU1MgYXNzZXQgdXNpbmcgZXNidWlsZC5cbiAgICpcbiAgICogQHBhcmFtIGlucHV0IFRoZSBDU1MgYXNzZXQgc291cmNlIGNvbnRlbnQgdG8gb3B0aW1pemUuXG4gICAqIEBwYXJhbSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBDU1MgYXNzZXQuIFVzZWQgdG8gZ2VuZXJhdGUgc291cmNlIG1hcHMuXG4gICAqIEBwYXJhbSBpbnB1dE1hcCBPcHRpb25hbGx5IHNwZWNpZmllcyB0aGUgQ1NTIGFzc2V0J3Mgb3JpZ2luYWwgc291cmNlIG1hcCB0aGF0IHdpbGxcbiAgICogYmUgbWVyZ2VkIHdpdGggdGhlIGludGVybWVkaWF0ZSBvcHRpbWl6ZWQgc291cmNlIG1hcC5cbiAgICogQHBhcmFtIHRhcmdldCBPcHRpb25hbGx5IHNwZWNpZmllcyB0aGUgdGFyZ2V0IGJyb3dzZXJzIGZvciB0aGUgb3V0cHV0IGNvZGUuXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSByZXNvbHZpbmcgdG8gdGhlIG9wdGltaXplZCBDU1MsIHNvdXJjZSBtYXAsIGFuZCBhbnkgd2FybmluZ3MuXG4gICAqL1xuICBwcml2YXRlIG9wdGltaXplKFxuICAgIGlucHV0OiBzdHJpbmcsXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIGlucHV0TWFwOiBvYmplY3QsXG4gICAgdGFyZ2V0OiBzdHJpbmdbXSB8IHVuZGVmaW5lZCxcbiAgKTogUHJvbWlzZTxUcmFuc2Zvcm1SZXN1bHQ+IHtcbiAgICBsZXQgc291cmNlTWFwTGluZTtcbiAgICBpZiAoaW5wdXRNYXApIHtcbiAgICAgIC8vIGVzYnVpbGQgd2lsbCBhdXRvbWF0aWNhbGx5IHJlbWFwIHRoZSBzb3VyY2VtYXAgaWYgcHJvdmlkZWRcbiAgICAgIHNvdXJjZU1hcExpbmUgPSBgXFxuLyojIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTg7YmFzZTY0LCR7QnVmZmVyLmZyb20oXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KGlucHV0TWFwKSxcbiAgICAgICkudG9TdHJpbmcoJ2Jhc2U2NCcpfSAqL2A7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZXNidWlsZC50cmFuc2Zvcm0oc291cmNlTWFwTGluZSA/IGlucHV0ICsgc291cmNlTWFwTGluZSA6IGlucHV0LCB7XG4gICAgICBsb2FkZXI6ICdjc3MnLFxuICAgICAgbGVnYWxDb21tZW50czogJ2lubGluZScsXG4gICAgICBtaW5pZnk6IHRydWUsXG4gICAgICBzb3VyY2VtYXA6ICEhaW5wdXRNYXAgJiYgJ2V4dGVybmFsJyxcbiAgICAgIHNvdXJjZWZpbGU6IG5hbWUsXG4gICAgICB0YXJnZXQsXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGFkZFdhcm5pbmdzKGNvbXBpbGF0aW9uOiBDb21waWxhdGlvbiwgd2FybmluZ3M6IE1lc3NhZ2VbXSkge1xuICAgIGlmICh3YXJuaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICBmb3IgKGNvbnN0IHdhcm5pbmcgb2YgYXdhaXQgdGhpcy5lc2J1aWxkLmZvcm1hdE1lc3NhZ2VzKHdhcm5pbmdzLCB7IGtpbmQ6ICd3YXJuaW5nJyB9KSkge1xuICAgICAgICBhZGRXYXJuaW5nKGNvbXBpbGF0aW9uLCB3YXJuaW5nKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzKHN1cHBvcnRlZEJyb3dzZXJzOiBzdHJpbmdbXSk6IHN0cmluZ1tdIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCB0cmFuc2Zvcm1lZDogc3RyaW5nW10gPSBbXTtcblxuICAgIC8vIGh0dHBzOi8vZXNidWlsZC5naXRodWIuaW8vYXBpLyN0YXJnZXRcbiAgICBjb25zdCBlc0J1aWxkU3VwcG9ydGVkQnJvd3NlcnMgPSBuZXcgU2V0KFsnc2FmYXJpJywgJ2ZpcmVmb3gnLCAnZWRnZScsICdjaHJvbWUnLCAnaW9zJ10pO1xuXG4gICAgZm9yIChjb25zdCBicm93c2VyIG9mIHN1cHBvcnRlZEJyb3dzZXJzKSB7XG4gICAgICBsZXQgW2Jyb3dzZXJOYW1lLCB2ZXJzaW9uXSA9IGJyb3dzZXIuc3BsaXQoJyAnKTtcblxuICAgICAgLy8gYnJvd3NlcnNsaXN0IHVzZXMgdGhlIG5hbWUgYGlvc19zYWZgIGZvciBpT1MgU2FmYXJpIHdoZXJlYXMgZXNidWlsZCB1c2VzIGBpb3NgXG4gICAgICBpZiAoYnJvd3Nlck5hbWUgPT09ICdpb3Nfc2FmJykge1xuICAgICAgICBicm93c2VyTmFtZSA9ICdpb3MnO1xuICAgICAgfVxuXG4gICAgICAvLyBicm93c2Vyc2xpc3QgdXNlcyByYW5nZXMgYDE1LjItMTUuM2AgdmVyc2lvbnMgYnV0IG9ubHkgdGhlIGxvd2VzdCBpcyByZXF1aXJlZFxuICAgICAgLy8gdG8gcGVyZm9ybSBtaW5pbXVtIHN1cHBvcnRlZCBmZWF0dXJlIGNoZWNrcy4gZXNidWlsZCBhbHNvIGV4cGVjdHMgYSBzaW5nbGUgdmVyc2lvbi5cbiAgICAgIFt2ZXJzaW9uXSA9IHZlcnNpb24uc3BsaXQoJy0nKTtcblxuICAgICAgaWYgKGVzQnVpbGRTdXBwb3J0ZWRCcm93c2Vycy5oYXMoYnJvd3Nlck5hbWUpKSB7XG4gICAgICAgIGlmIChicm93c2VyTmFtZSA9PT0gJ3NhZmFyaScgJiYgdmVyc2lvbiA9PT0gJ1RQJykge1xuICAgICAgICAgIC8vIGVzYnVpbGQgb25seSBzdXBwb3J0cyBudW1lcmljIHZlcnNpb25zIHNvIGBUUGAgaXMgY29udmVydGVkIHRvIGEgaGlnaCBudW1iZXIgKDk5OSkgc2luY2VcbiAgICAgICAgICAvLyBhIFRlY2hub2xvZ3kgUHJldmlldyAoVFApIG9mIFNhZmFyaSBpcyBhc3N1bWVkIHRvIHN1cHBvcnQgYWxsIGN1cnJlbnRseSBrbm93biBmZWF0dXJlcy5cbiAgICAgICAgICB2ZXJzaW9uID0gJzk5OSc7XG4gICAgICAgIH1cblxuICAgICAgICB0cmFuc2Zvcm1lZC5wdXNoKGJyb3dzZXJOYW1lICsgdmVyc2lvbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRyYW5zZm9ybWVkLmxlbmd0aCA/IHRyYW5zZm9ybWVkIDogdW5kZWZpbmVkO1xuICB9XG59XG4iXX0=