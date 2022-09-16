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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzLW9wdGltaXplci1wbHVnaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy93ZWJwYWNrL3BsdWdpbnMvY3NzLW9wdGltaXplci1wbHVnaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBSUgseUVBQTZEO0FBQzdELHlEQUFxRDtBQUVyRDs7R0FFRztBQUNILE1BQU0sV0FBVyxHQUFHLHVCQUF1QixDQUFDO0FBTTVDOzs7OztHQUtHO0FBQ0gsTUFBYSxrQkFBa0I7SUFJN0IsWUFBWSxPQUFtQztRQUZ2QyxZQUFPLEdBQUcsSUFBSSxrQ0FBZSxFQUFFLENBQUM7UUFHdEMsSUFBSSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsaUJBQWlCLEVBQUU7WUFDOUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsbUNBQW1DLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7U0FDcEY7SUFDSCxDQUFDO0lBRUQsS0FBSyxDQUFDLFFBQWtCO1FBQ3RCLE1BQU0sRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFFckUsUUFBUSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUFFO1lBQzFELE1BQU0sTUFBTSxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsa0NBQWtDLENBQUMsQ0FBQztZQUV6RSxXQUFXLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQ3hDO2dCQUNFLElBQUksRUFBRSxXQUFXO2dCQUNqQixLQUFLLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsa0NBQWtDO2FBQ3ZFLEVBQ0QsS0FBSyxFQUFFLGlCQUFp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InNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2UsIFRyYW5zZm9ybVJlc3VsdCB9IGZyb20gJ2VzYnVpbGQnO1xuaW1wb3J0IHR5cGUgeyBDb21waWxhdGlvbiwgQ29tcGlsZXIsIHNvdXJjZXMgfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IGFkZFdhcm5pbmcgfSBmcm9tICcuLi8uLi91dGlscy93ZWJwYWNrLWRpYWdub3N0aWNzJztcbmltcG9ydCB7IEVzYnVpbGRFeGVjdXRvciB9IGZyb20gJy4vZXNidWlsZC1leGVjdXRvcic7XG5cbi8qKlxuICogVGhlIG5hbWUgb2YgdGhlIHBsdWdpbiBwcm92aWRlZCB0byBXZWJwYWNrIHdoZW4gdGFwcGluZyBXZWJwYWNrIGNvbXBpbGVyIGhvb2tzLlxuICovXG5jb25zdCBQTFVHSU5fTkFNRSA9ICdhbmd1bGFyLWNzcy1vcHRpbWl6ZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIENzc09wdGltaXplclBsdWdpbk9wdGlvbnMge1xuICBzdXBwb3J0ZWRCcm93c2Vycz86IHN0cmluZ1tdO1xufVxuXG4vKipcbiAqIEEgV2VicGFjayBwbHVnaW4gdGhhdCBwcm92aWRlcyBDU1Mgb3B0aW1pemF0aW9uIGNhcGFiaWxpdGllcy5cbiAqXG4gKiBUaGUgcGx1Z2luIHVzZXMgYm90aCBgZXNidWlsZGAgdG8gcHJvdmlkZSBib3RoIGZhc3QgYW5kIGhpZ2hseS1vcHRpbWl6ZWRcbiAqIGNvZGUgb3V0cHV0LlxuICovXG5leHBvcnQgY2xhc3MgQ3NzT3B0aW1pemVyUGx1Z2luIHtcbiAgcHJpdmF0ZSB0YXJnZXRzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBlc2J1aWxkID0gbmV3IEVzYnVpbGRFeGVjdXRvcigpO1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM/OiBDc3NPcHRpbWl6ZXJQbHVnaW5PcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnM/LnN1cHBvcnRlZEJyb3dzZXJzKSB7XG4gICAgICB0aGlzLnRhcmdldHMgPSB0aGlzLnRyYW5zZm9ybVN1cHBvcnRlZEJyb3dzZXJzVG9UYXJnZXRzKG9wdGlvbnMuc3VwcG9ydGVkQnJvd3NlcnMpO1xuICAgIH1cbiAgfVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcikge1xuICAgIGNvbnN0IHsgT3JpZ2luYWxTb3VyY2UsIFNvdXJjZU1hcFNvdXJjZSB9ID0gY29tcGlsZXIud2VicGFjay5zb3VyY2VzO1xuXG4gICAgY29tcGlsZXIuaG9va3MuY29tcGlsYXRpb24udGFwKFBMVUdJTl9OQU1FLCAoY29tcGlsYXRpb24pID0+IHtcbiAgICAgIGNvbnN0IGxvZ2dlciA9IGNvbXBpbGF0aW9uLmdldExvZ2dlcignYnVpbGQtYW5ndWxhci5Dc3NPcHRpbWl6ZXJQbHVnaW4nKTtcblxuICAgICAgY29tcGlsYXRpb24uaG9va3MucHJvY2Vzc0Fzc2V0cy50YXBQcm9taXNlKFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogUExVR0lOX05BTUUsXG4gICAgICAgICAgc3RhZ2U6IGNvbXBpbGVyLndlYnBhY2suQ29tcGlsYXRpb24uUFJPQ0VTU19BU1NFVFNfU1RBR0VfT1BUSU1JWkVfU0laRSxcbiAgICAgICAgfSxcbiAgICAgICAgYXN5bmMgKGNvbXBpbGF0aW9uQXNzZXRzKSA9PiB7XG4gICAgICAgICAgY29uc3QgY2FjaGUgPSBjb21waWxhdGlvbi5vcHRpb25zLmNhY2hlICYmIGNvbXBpbGF0aW9uLmdldENhY2hlKFBMVUdJTl9OQU1FKTtcblxuICAgICAgICAgIGxvZ2dlci50aW1lKCdvcHRpbWl6ZSBjc3MgYXNzZXRzJyk7XG4gICAgICAgICAgZm9yIChjb25zdCBhc3NldE5hbWUgb2YgT2JqZWN0LmtleXMoY29tcGlsYXRpb25Bc3NldHMpKSB7XG4gICAgICAgICAgICBpZiAoIS9cXC4oPzpjc3N8c2Nzc3xzYXNzfGxlc3MpJC8udGVzdChhc3NldE5hbWUpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGNvbXBpbGF0aW9uLmdldEFzc2V0KGFzc2V0TmFtZSk7XG4gICAgICAgICAgICAvLyBTa2lwIGFzc2V0cyB0aGF0IGhhdmUgYWxyZWFkeSBiZWVuIG9wdGltaXplZCBvciBhcmUgdmVyYmF0aW0gY29waWVzIChwcm9qZWN0IGFzc2V0cylcbiAgICAgICAgICAgIGlmICghYXNzZXQgfHwgYXNzZXQuaW5mby5taW5pbWl6ZWQgfHwgYXNzZXQuaW5mby5jb3BpZWQpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHsgc291cmNlOiBzdHlsZUFzc2V0U291cmNlLCBuYW1lIH0gPSBhc3NldDtcbiAgICAgICAgICAgIGxldCBjYWNoZUl0ZW07XG5cbiAgICAgICAgICAgIGlmIChjYWNoZSkge1xuICAgICAgICAgICAgICBjb25zdCBlVGFnID0gY2FjaGUuZ2V0TGF6eUhhc2hlZEV0YWcoc3R5bGVBc3NldFNvdXJjZSk7XG4gICAgICAgICAgICAgIGNhY2hlSXRlbSA9IGNhY2hlLmdldEl0ZW1DYWNoZShuYW1lLCBlVGFnKTtcbiAgICAgICAgICAgICAgY29uc3QgY2FjaGVkT3V0cHV0ID0gYXdhaXQgY2FjaGVJdGVtLmdldFByb21pc2U8XG4gICAgICAgICAgICAgICAgeyBzb3VyY2U6IHNvdXJjZXMuU291cmNlOyB3YXJuaW5nczogTWVzc2FnZVtdIH0gfCB1bmRlZmluZWRcbiAgICAgICAgICAgICAgPigpO1xuXG4gICAgICAgICAgICAgIGlmIChjYWNoZWRPdXRwdXQpIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIuZGVidWcoYCR7bmFtZX0gcmVzdG9yZWQgZnJvbSBjYWNoZWApO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYWRkV2FybmluZ3MoY29tcGlsYXRpb24sIGNhY2hlZE91dHB1dC53YXJuaW5ncyk7XG4gICAgICAgICAgICAgICAgY29tcGlsYXRpb24udXBkYXRlQXNzZXQobmFtZSwgY2FjaGVkT3V0cHV0LnNvdXJjZSwgKGFzc2V0SW5mbykgPT4gKHtcbiAgICAgICAgICAgICAgICAgIC4uLmFzc2V0SW5mbyxcbiAgICAgICAgICAgICAgICAgIG1pbmltaXplZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgeyBzb3VyY2UsIG1hcDogaW5wdXRNYXAgfSA9IHN0eWxlQXNzZXRTb3VyY2Uuc291cmNlQW5kTWFwKCk7XG4gICAgICAgICAgICBjb25zdCBpbnB1dCA9IHR5cGVvZiBzb3VyY2UgPT09ICdzdHJpbmcnID8gc291cmNlIDogc291cmNlLnRvU3RyaW5nKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IG9wdGltaXplQXNzZXRMYWJlbCA9IGBvcHRpbWl6ZSBhc3NldDogJHthc3NldC5uYW1lfWA7XG4gICAgICAgICAgICBsb2dnZXIudGltZShvcHRpbWl6ZUFzc2V0TGFiZWwpO1xuICAgICAgICAgICAgY29uc3QgeyBjb2RlLCB3YXJuaW5ncywgbWFwIH0gPSBhd2FpdCB0aGlzLm9wdGltaXplKFxuICAgICAgICAgICAgICBpbnB1dCxcbiAgICAgICAgICAgICAgYXNzZXQubmFtZSxcbiAgICAgICAgICAgICAgaW5wdXRNYXAsXG4gICAgICAgICAgICAgIHRoaXMudGFyZ2V0cyxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBsb2dnZXIudGltZUVuZChvcHRpbWl6ZUFzc2V0TGFiZWwpO1xuXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFkZFdhcm5pbmdzKGNvbXBpbGF0aW9uLCB3YXJuaW5ncyk7XG5cbiAgICAgICAgICAgIGNvbnN0IG9wdGltaXplZEFzc2V0ID0gbWFwXG4gICAgICAgICAgICAgID8gbmV3IFNvdXJjZU1hcFNvdXJjZShjb2RlLCBuYW1lLCBtYXApXG4gICAgICAgICAgICAgIDogbmV3IE9yaWdpbmFsU291cmNlKGNvZGUsIG5hbWUpO1xuICAgICAgICAgICAgY29tcGlsYXRpb24udXBkYXRlQXNzZXQobmFtZSwgb3B0aW1pemVkQXNzZXQsIChhc3NldEluZm8pID0+ICh7XG4gICAgICAgICAgICAgIC4uLmFzc2V0SW5mbyxcbiAgICAgICAgICAgICAgbWluaW1pemVkOiB0cnVlLFxuICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICBhd2FpdCBjYWNoZUl0ZW0/LnN0b3JlUHJvbWlzZSh7XG4gICAgICAgICAgICAgIHNvdXJjZTogb3B0aW1pemVkQXNzZXQsXG4gICAgICAgICAgICAgIHdhcm5pbmdzLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGxvZ2dlci50aW1lRW5kKCdvcHRpbWl6ZSBjc3MgYXNzZXRzJyk7XG4gICAgICAgIH0sXG4gICAgICApO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIE9wdGltaXplcyBhIENTUyBhc3NldCB1c2luZyBlc2J1aWxkLlxuICAgKlxuICAgKiBAcGFyYW0gaW5wdXQgVGhlIENTUyBhc3NldCBzb3VyY2UgY29udGVudCB0byBvcHRpbWl6ZS5cbiAgICogQHBhcmFtIG5hbWUgVGhlIG5hbWUgb2YgdGhlIENTUyBhc3NldC4gVXNlZCB0byBnZW5lcmF0ZSBzb3VyY2UgbWFwcy5cbiAgICogQHBhcmFtIGlucHV0TWFwIE9wdGlvbmFsbHkgc3BlY2lmaWVzIHRoZSBDU1MgYXNzZXQncyBvcmlnaW5hbCBzb3VyY2UgbWFwIHRoYXQgd2lsbFxuICAgKiBiZSBtZXJnZWQgd2l0aCB0aGUgaW50ZXJtZWRpYXRlIG9wdGltaXplZCBzb3VyY2UgbWFwLlxuICAgKiBAcGFyYW0gdGFyZ2V0IE9wdGlvbmFsbHkgc3BlY2lmaWVzIHRoZSB0YXJnZXQgYnJvd3NlcnMgZm9yIHRoZSBvdXRwdXQgY29kZS5cbiAgICogQHJldHVybnMgQSBwcm9taXNlIHJlc29sdmluZyB0byB0aGUgb3B0aW1pemVkIENTUywgc291cmNlIG1hcCwgYW5kIGFueSB3YXJuaW5ncy5cbiAgICovXG4gIHByaXZhdGUgb3B0aW1pemUoXG4gICAgaW5wdXQ6IHN0cmluZyxcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgaW5wdXRNYXA6IG9iamVjdCxcbiAgICB0YXJnZXQ6IHN0cmluZ1tdIHwgdW5kZWZpbmVkLFxuICApOiBQcm9taXNlPFRyYW5zZm9ybVJlc3VsdD4ge1xuICAgIGxldCBzb3VyY2VNYXBMaW5lO1xuICAgIGlmIChpbnB1dE1hcCkge1xuICAgICAgLy8gZXNidWlsZCB3aWxsIGF1dG9tYXRpY2FsbHkgcmVtYXAgdGhlIHNvdXJjZW1hcCBpZiBwcm92aWRlZFxuICAgICAgc291cmNlTWFwTGluZSA9IGBcXG4vKiMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldD11dGYtODtiYXNlNjQsJHtCdWZmZXIuZnJvbShcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoaW5wdXRNYXApLFxuICAgICAgKS50b1N0cmluZygnYmFzZTY0Jyl9ICovYDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5lc2J1aWxkLnRyYW5zZm9ybShzb3VyY2VNYXBMaW5lID8gaW5wdXQgKyBzb3VyY2VNYXBMaW5lIDogaW5wdXQsIHtcbiAgICAgIGxvYWRlcjogJ2NzcycsXG4gICAgICBsZWdhbENvbW1lbnRzOiAnaW5saW5lJyxcbiAgICAgIG1pbmlmeTogdHJ1ZSxcbiAgICAgIHNvdXJjZW1hcDogISFpbnB1dE1hcCAmJiAnZXh0ZXJuYWwnLFxuICAgICAgc291cmNlZmlsZTogbmFtZSxcbiAgICAgIHRhcmdldCxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgYWRkV2FybmluZ3MoY29tcGlsYXRpb246IENvbXBpbGF0aW9uLCB3YXJuaW5nczogTWVzc2FnZVtdKSB7XG4gICAgaWYgKHdhcm5pbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAoY29uc3Qgd2FybmluZyBvZiBhd2FpdCB0aGlzLmVzYnVpbGQuZm9ybWF0TWVzc2FnZXMod2FybmluZ3MsIHsga2luZDogJ3dhcm5pbmcnIH0pKSB7XG4gICAgICAgIGFkZFdhcm5pbmcoY29tcGlsYXRpb24sIHdhcm5pbmcpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMoc3VwcG9ydGVkQnJvd3NlcnM6IHN0cmluZ1tdKTogc3RyaW5nW10gfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHRyYW5zZm9ybWVkOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgLy8gaHR0cHM6Ly9lc2J1aWxkLmdpdGh1Yi5pby9hcGkvI3RhcmdldFxuICAgIGNvbnN0IGVzQnVpbGRTdXBwb3J0ZWRCcm93c2VycyA9IG5ldyBTZXQoWydzYWZhcmknLCAnZmlyZWZveCcsICdlZGdlJywgJ2Nocm9tZScsICdpb3MnXSk7XG5cbiAgICBmb3IgKGNvbnN0IGJyb3dzZXIgb2Ygc3VwcG9ydGVkQnJvd3NlcnMpIHtcbiAgICAgIGxldCBbYnJvd3Nlck5hbWUsIHZlcnNpb25dID0gYnJvd3Nlci5zcGxpdCgnICcpO1xuXG4gICAgICAvLyBicm93c2Vyc2xpc3QgdXNlcyB0aGUgbmFtZSBgaW9zX3NhZmAgZm9yIGlPUyBTYWZhcmkgd2hlcmVhcyBlc2J1aWxkIHVzZXMgYGlvc2BcbiAgICAgIGlmIChicm93c2VyTmFtZSA9PT0gJ2lvc19zYWYnKSB7XG4gICAgICAgIGJyb3dzZXJOYW1lID0gJ2lvcyc7XG4gICAgICB9XG5cbiAgICAgIC8vIGJyb3dzZXJzbGlzdCB1c2VzIHJhbmdlcyBgMTUuMi0xNS4zYCB2ZXJzaW9ucyBidXQgb25seSB0aGUgbG93ZXN0IGlzIHJlcXVpcmVkXG4gICAgICAvLyB0byBwZXJmb3JtIG1pbmltdW0gc3VwcG9ydGVkIGZlYXR1cmUgY2hlY2tzLiBlc2J1aWxkIGFsc28gZXhwZWN0cyBhIHNpbmdsZSB2ZXJzaW9uLlxuICAgICAgW3ZlcnNpb25dID0gdmVyc2lvbi5zcGxpdCgnLScpO1xuXG4gICAgICBpZiAoZXNCdWlsZFN1cHBvcnRlZEJyb3dzZXJzLmhhcyhicm93c2VyTmFtZSkpIHtcbiAgICAgICAgaWYgKGJyb3dzZXJOYW1lID09PSAnc2FmYXJpJyAmJiB2ZXJzaW9uID09PSAnVFAnKSB7XG4gICAgICAgICAgLy8gZXNidWlsZCBvbmx5IHN1cHBvcnRzIG51bWVyaWMgdmVyc2lvbnMgc28gYFRQYCBpcyBjb252ZXJ0ZWQgdG8gYSBoaWdoIG51bWJlciAoOTk5KSBzaW5jZVxuICAgICAgICAgIC8vIGEgVGVjaG5vbG9neSBQcmV2aWV3IChUUCkgb2YgU2FmYXJpIGlzIGFzc3VtZWQgdG8gc3VwcG9ydCBhbGwgY3VycmVudGx5IGtub3duIGZlYXR1cmVzLlxuICAgICAgICAgIHZlcnNpb24gPSAnOTk5JztcbiAgICAgICAgfVxuXG4gICAgICAgIHRyYW5zZm9ybWVkLnB1c2goYnJvd3Nlck5hbWUgKyB2ZXJzaW9uKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJhbnNmb3JtZWQubGVuZ3RoID8gdHJhbnNmb3JtZWQgOiB1bmRlZmluZWQ7XG4gIH1cbn1cbiJdfQ==